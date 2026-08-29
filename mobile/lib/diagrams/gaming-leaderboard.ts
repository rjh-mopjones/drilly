import type { Diagram } from "./types";

export const GAMING_LEADERBOARD: Diagram = {
  id: "gaming-leaderboard",
  title: "Gaming Leaderboard",
  question: "Design a Real-Time Gaming Leaderboard",
  sourceId: "patterns",
  itemId: 22,
  overview: {
    shape:
      "A durable log of server-computed scores feeds one ordered in-memory index per board, chosen because it can answer an arbitrary player's position without counting everyone above them.",
    forces: [
      {
        constraint: "An arbitrary rank query for player 50,000,000 has no shortcut, unlike a shared top-N",
        decision: "Redis sorted sets are chosen because a ZREVRANK descent accumulates rank as a byproduct, in ~50 microseconds",
        lights: ["zset-primary"],
      },
      {
        constraint: "60k ZADD/s at a contest burst would rewrite skip-list spans on every single write",
        decision: "The Board writer batches updates into 50ms windows so one round trip pays for ~500 ZADDs",
        lights: ["board-writer", "zset-primary", "e3", "e4"],
      },
      {
        constraint: "600k concurrent players polling every 2s is ~300k rank reads/s that no cache can share",
        decision: "Read replicas scale the read path independently of write sharding, 6 to 8 per busy board",
        lights: ["read-replicas", "e6"],
      },
      {
        constraint: "Exact rank costs the same at position 1 and position 50,000,000, and no player can tell 4,812,004 from 4,812,051 apart",
        decision: "The Leaderboard Service serves exact ZREVRANK only above rank 10,000, and percentile buckets below it",
        lights: ["leaderboard-svc", "quantile-snapshots", "e7", "e8"],
      },
      {
        constraint: "5 board writes happen per match completion with no transaction spanning them",
        decision: "The Match event log is the system of record, so a board is a rebuildable derived index",
        lights: ["event-log", "score-history"],
      },
    ],
    naive: {
      text: "Have the client submit its own score directly, and let the API write straight into one big sorted set. Rank is then computed by counting every entry above the player on each read. A trusted client score reaches a board that 100M players compare themselves against, and nothing stops a forged submission. Counting entries above a player scales with position, so a median-rank read on a 100M-player board is tens of millions of comparisons, hundreds of milliseconds against a 100ms budget. The Leaderboard Service replaces client-submitted scores with server-authoritative ones computed from match facts, and the sorted set's skip-list span turns that same counting into one O(log N) descent.",
      lights: ["leaderboard-svc", "zset-primary"],
    },
    beats: [
      {
        text: "Ingestion never trusts the client. The client sends match facts, the leaderboard service computes the score, and the result is appended to a partitioned durable log before anything touches a board. That log is the system of record, which is what makes an in-memory board acceptable: it is a derived index, not a database.",
        lights: ["clients", "leaderboard-svc", "event-log", "e1", "e2"],
      },
      {
        text: "The board is one sorted set per logical board key. A sorted set is a skip list plus a hash table, and every forward pointer in the skip list carries a span, the number of nodes it jumps. Rank therefore accumulates during the descent the lookup was doing anyway, so ZREVRANK is O(log N) and lands in roughly 50 microseconds.",
        lights: ["zset-primary"],
      },
      {
        text: "Writes are batched into 50ms windows because span maintenance is the expensive half. Every rank-changing ZADD rewrites spans up the whole tower, and at the 60k/s contest burst that is a real share of one event loop. One round trip carrying 500 ZADDs pays the syscall once and still meets the 5s visibility budget.",
        lights: ["board-writer", "zset-primary", "e3", "e4"],
      },
      {
        text: "The read path is the burst that defines the system. 600k concurrent players polling every 2s is around 300k rank reads per second, and unlike top-N those cannot be shared between users, so no cache collapses them. They go to 6 to 8 read replicas at roughly 100k ops/s each, which is a different scaling axis from write sharding.",
        lights: ["clients", "read-replicas", "e6"],
      },
      {
        text: "Below the head, exactness stops being worth anything. Exact rank for player 50,000,000 costs the same as rank 1, and no player can tell 4,812,004 from 4,812,051. So the top 10,000 get an exact ZREVRANK, and everyone below gets a percentile bucket from quantile snapshots refreshed every 60s.",
        lights: ["leaderboard-svc", "quantile-snapshots", "e7", "e8"],
      },
      {
        text: "Lifecycle is naming rather than migration. Daily, weekly, all-time and regional boards are separate keys with TTLs, so a reset is a key expiring. Tomorrow's key is pre-created five minutes before midnight, so the first write after the boundary does not race every other service instance into existence.",
        lights: ["board-keys", "e9"],
      },
    ],
    crux: {
      problem:
        "An arbitrary player's rank is a counting question, not a lookup. Top-N falls out of any index on score. Position 4,812,004 does not, and that single requirement decides the data structure, whether you can shard, and whether approximation is allowed.",
      handled:
        "The sorted set's skip-list span answers rank during the same descent that finds the player, so exactness stays cheap up to one primary's ~100k ops/s ceiling. Past roughly 60k ZADD/s on the busiest key, an exact answer at scale would need sharding, which turns one rank read into a fan-out across every shard. The design avoids that by keeping the board unsharded and spending approximation below rank 10,000 instead, where the number is not distinguishable to a player anyway.",
    },
    numbers: [
      {
        value: "60k ZADD/s burst on one key",
        explain: "The busiest board's write rate at contest close, roughly 60% of one primary's ~100k ops/s ceiling; the number the batching window is sized against.",
      },
      {
        value: "~300k rank reads/s at contest close",
        explain: "600k concurrent players polling every 2s. Per-player reads cannot be shared between users, so this number sizes the read replica count directly rather than a cache.",
      },
      {
        value: "100M players x ~90B = ~9GB all-time board",
        explain: "Per-entry cost inside the skip list times the registered player count; small enough that the whole all-time board fits comfortably in one primary's memory.",
      },
      {
        value: "~50 microsecond ZREVRANK",
        explain: "Rank accumulates as a byproduct of the skip-list descent that already has to run to find the player. So an exact rank read costs about as much as any other lookup.",
      },
      {
        value: "exact above rank 10,000, bucketed below",
        explain: "The cutoff between the two rank-serving paths; above it a player gets an exact ZREVRANK, below it a percentile bucket refreshed every 60 seconds.",
      },
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
          { value: "~35GB of primaries", explain: "Seven daily boards, four weekly, all-time and the regional set summed at roughly 90 bytes per entry; the number capacity planning starts from." },
          { value: "~125GB with replicas", explain: "The primary total times the replica factor needed for the read tier; this is what the fleet is actually provisioned for." },
          { value: "8 nodes x 32GB with room", explain: "The node count and size that comfortably holds the replicated total with headroom for growth in registered players." },
        ],
        breaks: {
          failure: "Board sprawl: a per-room or per-match key means millions of near-empty sorted sets.",
          handled: "Per-key overhead then dominates the data itself, so small boards belong in one shared key with a composite member instead of a key of their own.",
        },
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
        why: "It is drawn because it sets both hard constraints: the client is untrusted, so it may never assert a score. Its polling behaviour is also what produces the read burst the whole read tier is sized for.",
        numbers: [
          {
            value: "600k concurrent at prime time",
            explain: "The peak simultaneous player count; this, times the polling cadence, is what produces the read burst the whole read tier is sized for.",
          },
          { value: "poll every 2s during a contest", explain: "The client's own cadence; it is what turns a modest player count into a large steady request rate rather than a bursty one." },
          {
            value: "~40 rank or board views per session",
            explain: "A typical session's read volume; multiplied across concurrent players it is the baseline the replica count has to absorb outside a contest spike too.",
          },
        ],
        breaks: {
          failure: "A client-trusted score reaches the board, or every client polls on the same 2s cadence.",
          handled: "Scoring is server-authoritative so a forged score has nowhere to land, and served poll intervals are jittered slightly so a synchronised wave never forms.",
        },
      },
    },
    {
      id: "leaderboard-svc",
      label: "Leaderboard Service",
      sub: "server-authoritative scoring",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "Computes the score from submitted event facts, resolves a logical board id to a concrete key, and decides whether a rank read is answered exactly or as a bucket.",
        why: "Scoring has to happen somewhere the player cannot reach, and the exact-versus-bucketed fork has to happen somewhere that knows the player's approximate position. Putting both here keeps the storage tier a dumb ordered index with no policy in it.",
        numbers: [
          { value: "rank read p99 under 100ms", explain: "The latency budget a rank read must meet; it is what rules out counting rows above a player on every read." },
          {
            value: "exact above rank 10,000, bucketed below",
            explain: "The fork the service enforces on every response: above this rank the client gets a real ZREVRANK, below it a percentile band.",
          },
          {
            value: "match visible in under 5s",
            explain: "The visibility SLO between a match completing and its score appearing on a board; the batching window downstream stays well inside it.",
          },
        ],
        breaks: {
          failure: "It owns the 'exact' flag in the API contract, and a wrong value there is invisible until read.",
          handled:
            "A client that ignores or mishandles the flag renders a bucketed guess as a precise number, worse than showing a band, so the contract makes exactness an explicit boolean.",
        },
        choice: {
          pick: "Server-authoritative scoring from event facts, with a 202 on submission",
          instead: "Accepting a score the client computed, validated by plausibility rules.",
          decider:
            "Whether a forged number can enter a board that 100M players compare themselves against. Validation catches implausible jumps but nothing stops a client asserting a legal-looking score. The write path is asynchronous anyway, with a 5s visibility budget, so there is no latency argument for trusting the client.",
          flips: "A single-player or cosmetic board with no payout and no competitive meaning, where the cost of server-side simulation exceeds the cost of the occasional fake score.",
        },
      },
    },
    {
      id: "event-log",
      label: "Match event log",
      sub: "partitioned, durable, replayable",
      kind: "queue",
      col: 1,
      row: 1,
      detail: {
        what: "The durable partitioned log every scored match completion lands on before any board is written.",
        why: "This is what demotes the sorted set to an index. A crash then costs the last second of writes plus a rebuild, rather than the game's history. Anything that pays out money can be computed from a sequence boundary in the log, rather than read off a board.",
        numbers: [
          { value: "50M match completions/day", explain: "The daily volume of scored matches; every other write-side number in the design is a multiple of this one." },
          {
            value: "250M board writes/day across 5 boards",
            explain: "Each completion fans out to five board keys (daily, weekly, all-time, two regional), which is why board write volume is 5x match volume.",
          },
          {
            value: "~2.9k writes/s average, ~12k/s peak hour",
            explain: "The average and peak write rate the log itself has to sustain; the board writer downstream batches this down before it reaches Redis.",
          },
        ],
        breaks: {
          failure: "One match writes five board keys with no transaction spanning them.",
          handled: "A player can be rank 12 on the daily board and briefly absent from the regional one, since the boards are only eventually consistent with each other.",
        },
        choice: {
          pick: "A partitioned durable log as the system of record, boards derived from it",
          instead: "Writing the sorted set directly from the request and treating Redis as the record.",
          decider:
            "What a primary loss costs. AOF everysec bounds loss to about 1s of writes, and with the log those writes are replayable by sequence number instead of gone. Without it the in-memory board is the only copy of 250M writes/day and an eviction or a failed failover is unrecoverable data loss.",
          flips: "A board that is genuinely disposable, such as a per-match scoreboard for 20 players, where losing it means recomputing something trivial and the log is pure operational cost.",
        },
      },
    },
    {
      id: "board-writer",
      label: "Board writer",
      sub: "50ms batch windows",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "Consumes the log and applies score updates to the board keys as pipelined batches of ZADDs.",
        why: "The write cost on a sorted set is span maintenance up the skip-list tower, and that is paid per entry no matter what. Batching removes the other half, the syscall and round trip per update, which is what turns a 60k/s burst into something one primary absorbs.",
        numbers: [
          { value: "50 to 100ms batch windows", explain: "The batching window's range; wide enough to amortise the round trip, narrow enough to stay far inside the 5s visibility budget." },
          { value: "~500 ZADDs per round trip", explain: "The typical batch size at contest-level write rates; one pipelined round trip replaces roughly 500 individual syscalls." },
          { value: "one primary ceiling ~100k ops/s", explain: "The write throughput one Redis primary can sustain before span-maintenance cost saturates its single event loop." },
        ],
        breaks: {
          failure: "Delivery is at-least-once, so a replayed batch re-applies a ZADD.",
          handled: "That is idempotent for an absolute score and wrong for an increment, which is why every board write carries a value rather than a delta.",
        },
        choice: {
          pick: "Batched writes in 50ms windows off the log",
          instead: "Write-through: one ZADD per match completion, synchronously on the request path.",
          decider:
            "The freshness budget against the event-loop cost. Visibility only has to be under 5s, so a 50ms window is invisible to the product. Amortising the syscall lifts the effective ceiling from roughly 100k ops/s to a few hundred thousand. The 60k/s contest burst is 60% of one primary unbatched.",
          flips: "A board with a sub-second visibility requirement, or write rates low enough that the ceiling never binds, where batching only adds latency and a consumer to operate.",
        },
      },
    },
    {
      id: "zset-primary",
      label: "Sorted set primary",
      sub: "ZADD / ZREVRANK / ZREVRANGE",
      kind: "database",
      col: 2,
      row: 2,
      parent: "redis-group",
      detail: {
        what: "One Redis sorted set per board: a skip list ordered by score, paired with a hash table from member to score.",
        why: "Every forward pointer in the skip list carries a span, the count of nodes it jumps. Rank is accumulated during that descent rather than by counting entries above the player. That one field is the entire reason this structure is chosen over any other sorted container. This design deliberately does not shard a board. At 60k ZADD/s on the busiest key, one primary sits at roughly 60% of its ~100k ops/s ceiling. Splitting into score-range bands across several primaries stays an escape hatch for sustained write rates above ~200k/s. A coarse counter layer would keep rank at two operations instead of a full fan-out, if that escape hatch is ever needed.",
        numbers: [
          { value: "ZREVRANK ~50 microseconds", explain: "The server-side cost of an exact rank read, since it reuses the same descent used to locate the player." },
          {
            value: "~90B per entry, 9GB for 100M players",
            explain: "Per-member memory inside the skip list and hash table, times the registered player count; the number the all-time board's size is built from.",
          },
          {
            value: "packed = points * 2^31 + (2^31 - 1 - t)",
            explain: "The tiebreaker packed into the score itself: an earlier timestamp t produces a larger packed value, so ties resolve to whoever reached the score first.",
          },
          {
            value: "one primary ceiling ~100k ZADD/s, shard above ~200k/s sustained",
            explain: "The point at which a single primary's write throughput stops being enough, and score-range sharding becomes worth its added complexity.",
          },
        ],
        breaks: {
          failure: "Ties are undefined unless you define them: equal scores order by member bytes, which is arbitrary and permanently stable.",
          handled: "The same player wins every tie forever, until the tiebreaker is packed into the score itself so ties resolve by who reached the score first.",
        },
        choice: {
          pick: "Redis sorted set: ZADD to write, ZREVRANK for position, ZREVRANGE for top-N",
          instead: "Postgres with a B-tree on (board_id, score) descending: top-N via an indexed range scan, rank via counting rows that outscore the player. Or a rank column, recomputed by a periodic windowed pass.",
          decider:
            "Arbitrary rank, not top-N, is the deciding question. The B-tree matches Redis on top-100 but loses badly on rank, because the index stores no rank at all. Counting walks every entry above the player: 50M index tuples for a median player on a 100M board, hundreds of milliseconds against a 100ms budget. The batch alternative replaces that with an O(100M) pass per refresh, and at 60k writes/s the order moves faster than a 60s job can republish it.",
          flips:
            "Rank is only ever served for the top few hundred, or the board moves on a human cadence. A 200k-row company board recomputed hourly is a materialised view and a cron job. It also flips when standings must be transactionally consistent with a prize ledger, because the sorted set gives you no transaction with the money.",
        },
      },
    },
    {
      id: "read-replicas",
      label: "Read replicas",
      sub: "6 to 8 on the contest board",
      kind: "database",
      col: 2,
      row: 1,
      parent: "redis-group",
      detail: {
        what: "Async replicas of each board primary, serving every rank and top-N read.",
        why: "Rank and top-N are read-only, so read volume scales on replicas while write rate scales on shards, and conflating the two is the classic mistake here. Sharding a board with a read problem multiplies round trips per read and adds no read capacity at all.",
        numbers: [
          { value: "~100k ops/s per instance", explain: "The read throughput one replica sustains; this, not data size, is what the replica count is derived from." },
          {
            value: "300k rank reads/s / 100k = 3 minimum, 6 to 8 for headroom",
            explain: "The arithmetic behind the replica count: three would exactly cover peak load, so the design runs 6 to 8 to survive a lost node during a contest.",
          },
          { value: "route reads away above 500ms lag", explain: "The lag threshold past which a replica is pulled from rotation, since it would otherwise answer confidently with a stale rank." },
        ],
        breaks: {
          failure: "Replication lag spikes during a snapshot fork on the primary.",
          handled: "A lagging replica serves a confidently wrong rank rather than an error, so reads have to be routed away once lag crosses the 500ms threshold.",
        },
        choice: {
          pick: "Read replicas sized from read volume, not data size",
          instead: "More write shards, or a per-user response cache in front of the API.",
          decider:
            "Whether the reads can be shared. 300k/s of rank reads are per-player and therefore uncacheable across users, so a 1 to 2s response cache barely helps a client polling every 2s. Top-N is the opposite, one shared object where an edge cache collapses any read rate to about 1 backend read/s.",
          flips:
            "When the burst is push-shaped rather than poll-shaped. Publishing rank changes over the WebSocket the client already holds removes most of the 300k/s instead of serving it, and the replica count falls out.",
        },
      },
    },
    {
      id: "board-keys",
      label: "Board key registry",
      sub: "lb:daily/weekly/alltime/region",
      kind: "service",
      col: 2,
      row: 0,
      detail: {
        what: "Maps a logical board plus date and region to a concrete key, sets its TTL, and pre-creates the next period's key before the boundary.",
        why: "Making the period part of the key turns a daily reset into a key expiring rather than a migration or a mass delete, and makes rollover a naming event. The pre-creation exists because lazy creation races every service instance at exactly midnight.",
        numbers: [
          { value: "lb:daily:{yyyy-mm-dd} TTL 7d", explain: "The concrete key format for a daily board; the TTL is the entire reset mechanism, no delete or migration involved." },
          { value: "lb:weekly:{yyyy-ww} TTL 30d", explain: "The weekly equivalent; a longer TTL because weekly standings stay relevant, and queryable, for longer after the period ends." },
          { value: "next key created 5 minutes early", explain: "The lead time before a period boundary; long enough that every service instance finds the new key already writable at the tick." },
        ],
        breaks: {
          failure: "At 00:00 UTC the new key must already accept writes.",
          handled: "Created lazily it is empty for the first reads, which return rank nil to a thundering herd at the worst possible moment, so it is pre-created instead.",
        },
        choice: {
          pick: "One key per (scope, period) with a TTL, next period pre-created with a sentinel member",
          instead: "A single board with a period column, reset by deleting or rewriting entries at the boundary.",
          decider:
            "What happens at the tick. Thousands of writes per second are in flight in the five minutes either side of midnight. A delete-and-rewrite of a 900MB daily board is a stop-the-world operation on a serving primary. Expiry costs nothing and the old key keeps serving historical reads until its 7 day TTL runs out.",
          flips: "Boards whose period is not known in advance, such as a tournament that ends when a condition is met rather than at a wall-clock time. There the key cannot be named ahead of the boundary.",
        },
      },
    },
    {
      id: "score-history",
      label: "Score history store",
      sub: "relational, authoritative",
      kind: "database",
      col: 0,
      row: 1,
      detail: {
        what: "The durable relational record of players and their score history, written from the same log that feeds the boards.",
        why: "The board holds a current value per player and nothing else: no history, no joins, no transactions. Anything that pays out, audits a result or reverses a cheater needs a store that can answer those questions, and it is deliberately off the hot path.",
        numbers: [
          { value: "100M registered players", explain: "The player population the store has to index; small next to the write volume, since most rows update rarely." },
          {
            value: "AOF alone is ~25GB/day, ~190GB for 30 days cold",
            explain: "What Redis's own durability file would cost to keep for a month; the reason a separate relational store carries the long-term record instead.",
          },
        ],
        breaks: {
          failure: "Rebuilding the all-time board from here means replaying roughly 250M writes at maybe 100k/s.",
          handled: "That is tens of minutes with no reads served, so the store also needs retention covering the board's whole life, not just 24 hours.",
        },
        choice: {
          pick: "A relational store plus the event log as the record, with the board as a derived index",
          instead: "Treating Redis as the system of record, backed only by AOF and snapshots.",
          decider:
            "What you can answer after the fact. AOF bounds loss to about 1s but stores commands, not history, so a retroactive cheat removal or a payout dispute has nothing to query. It also means an in-memory board of 9GB is the only copy of the data, which no one signs off on.",
          flips: "Ephemeral boards with no payout, no audit and no history requirement, where the log retention alone covers rebuild and a second store earns nothing.",
        },
      },
    },
    {
      id: "aof-snapshots",
      label: "AOF + hourly snapshots",
      sub: "fork on a non-serving replica",
      kind: "database",
      col: 3,
      row: 2,
      detail: {
        what: "Append-only file on the primary plus periodic RDB snapshots shipped to a blob store.",
        why: "Neither is the durability story, the event log is. These exist to bound the two recovery numbers. AOF everysec bounds the recovery point to about a second. The snapshot bounds cold-start time, so a rebuild does not have to replay the board's whole lifetime.",
        numbers: [
          { value: "AOF everysec, ~1s recovery point", explain: "The bound on write loss if the primary dies; the log can replay past this, so this figure only matters during the replay window itself." },
          { value: "1 snapshot per hour", explain: "How often a full RDB is taken; the interval bounds how much AOF has to be replayed after loading a snapshot." },
          {
            value: "~30s replica promotion vs tens of minutes for a full rebuild",
            explain: "The gap between failing over to a warm replica and rebuilding a primary from scratch, which is why promotion is the primary recovery path.",
          },
        ],
        breaks: {
          failure: "An RDB snapshot forks the process, and copy-on-write faults stall the event loop for hundreds of milliseconds on a 9GB board.",
          handled: "Replication backs up behind the stall, which is why the fork happens on a replica serving no traffic rather than on a primary under load.",
        },
        choice: {
          pick: "AOF everysec on the primary, RDB snapshots taken from a dedicated non-serving replica",
          instead: "AOF fsync always, or snapshotting directly from the serving primary.",
          decider:
            "The cost of each guarantee against what the log already covers. Fsync-always makes every ZADD a disk write, destroying the ~100k ops/s ceiling to save 1 second of loss the log can replay anyway. Snapshotting on the primary trades hundreds of milliseconds of event-loop stall for a file that could be taken elsewhere for free.",
          flips: "No event log in front, where AOF is the only durability and every-second loss is unacceptable, at which point you pay the fsync and accept a much lower write ceiling.",
        },
      },
    },
    {
      id: "quantile-snapshots",
      label: "Quantile snapshots",
      sub: "bucketed percentile, 60s",
      kind: "database",
      col: 3,
      row: 0,
      detail: {
        what: "A small periodic summary of the score distribution, held as a bucket array in the API process, answering 'top 3%' for players too deep for a number to mean anything.",
        why: "Exact rank for player 50,000,000 costs exactly what rank 1 costs, and conveys nothing. 4,812,004 and 4,812,051 are 47 places apart out of 100M, and no player can tell them apart. This is the product concession that keeps the deep tail off the exact path.",
        numbers: [
          { value: "refreshed every 60s", explain: "The staleness of the bucket summary; acceptable because the shape of a 100M-player distribution barely moves inside a minute." },
          { value: "exact above rank 10,000, bucketed below", explain: "The same cutoff enforced by the leaderboard service; this store only ever answers the bucketed side of it." },
          {
            value: "one lookup in a ~200 entry array",
            explain: "One index into the ~200-bucket array built every 60s, versus the 1 rank call plus 7 shard counts an exact answer costs — turning 300k reads/s into 2.4M ops/s.",
          },
        ],
        breaks: {
          failure: "It lags the board by design, so it must never serve the head.",
          handled:
            "At 60k writes/s and 200ms of lag, up to 12,000 uncounted entries would rewrite the podium. At rank 4.2M the same lag is invisible, so exactness is reserved for the head alone.",
        },
        choice: {
          pick: "Exact rank for roughly the top 10,000, percentile buckets below it",
          instead: "Exact rank for every player on every read, paying whatever fan-out that costs.",
          decider:
            "What exactness costs once the board is sharded, plus what a player can perceive. On one unsharded primary exact rank is a single O(log N) call and this fork does not exist. Across 8 shards it is 1 rank call plus 7 counts, so 300k reads/s becomes 2.4M ops/s. That answers a question whose bucketed form is already one array lookup in process.",
          flips: "Rank carries money or status at every position, such as a tournament paying down to rank 50,000 or a ladder feeding matchmaking. Then a bucket is not a simplification, it is a wrong answer, and you pay for the round trips.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "clients",
      to: "leaderboard-svc",
      tier: "hot",
      step: 1,
      label: "match facts / rank read",
      detail: {
        what: "Two request shapes on one connection: POST /score carrying event facts, and GET /rank asking where this player sits.",
        why: "They travel on the same connection because the client cannot tell them apart. But they load completely different halves of the system: one is 2.9k/s of writes, the other is the 300k/s burst that sizes the read tier.",
        numbers: [
          {
            value: "~300k rank reads/s at contest close",
            explain: "The read-side peak this single connection carries; it is why the edge is drawn hot even though writes on it are comparatively rare.",
          },
          { value: "POST /score returns 202", explain: "The write acknowledgement means accepted, not scored and visible; the client learns nothing about its new rank from this response." },
        ],
        breaks: {
          failure: "Polling is the failure.",
          handled: "A client asking every 2s sends the same request whether or not its rank moved. The fix is pushing rank changes over the WebSocket that already exists.",
        },
      },
    },
    {
      id: "e2",
      from: "leaderboard-svc",
      to: "event-log",
      tier: "hot",
      step: 2,
      label: "scored match events",
      detail: {
        what: "The server-computed score appended to the durable log, keyed so a player's updates stay ordered.",
        why: "Nothing writes a board before this append succeeds, which is what makes the board a derived index. The acknowledgement to the client is a 202 against this write, not against the board.",
        numbers: [
          { value: "50M completions/day", explain: "The volume landing on this edge; every board write downstream is a multiple of it." },
          { value: "5 board writes per completion", explain: "Each scored match fans out to five board keys once it reaches the writer, which is why board volume is 5x this number." },
        ],
        breaks: {
          failure: "One completion fans out to five board keys with no transaction spanning them.",
          handled: "At-least-once retries can leave the boards briefly disagreeing with each other, which the design accepts since each key converges on its own.",
        },
      },
    },
    {
      id: "e3",
      from: "event-log",
      to: "board-writer",
      tier: "hot",
      step: 3,
      label: "batched 50ms windows",
      detail: {
        what: "The writer consuming the log and accumulating updates into a batch before touching Redis.",
        why: "The 5s visibility budget buys the batching window, and the window is what pays the syscall once for hundreds of updates instead of once each. It is also the natural place to feed the counter layer from the same batch.",
        numbers: [
          { value: "50 to 100ms windows", explain: "The batching interval the writer accumulates updates over before touching Redis." },
          { value: "~500 ZADDs per round trip", explain: "The typical batch size at contest write rates; the whole reason one syscall replaces hundreds." },
        ],
        breaks: {
          failure: "Consumer lag turns straight into staleness, and it is invisible from the board itself.",
          handled: "Rank reads keep answering fast, they just answer from a board that stopped moving, which is why lag needs its own alert rather than relying on read latency.",
        },
      },
    },
    {
      id: "e4",
      from: "board-writer",
      to: "zset-primary",
      tier: "hot",
      step: 4,
      label: "ZADD packed score",
      detail: {
        what: "The pipelined ZADDs themselves, each carrying the packed score that encodes points and the inverted timestamp together.",
        why: "The tiebreaker rides inside the score rather than beside it. The sorted set orders by exactly one number, and anything else would need a second lookup to break ties deterministically.",
        numbers: [
          {
            value: "packed = points * 2^31 + (2^31 - 1 - t)",
            explain: "The score every ZADD carries; encoding the tiebreaker inside it avoids a second lookup to break ties deterministically.",
          },
          { value: "51 bits inside a double's 53", explain: "How much of the double's precision the packed value uses, leaving 2 bits of headroom before the encoding would start rounding." },
        ],
        breaks: {
          failure: "Past 53 bits the encoding rounds silently, ties come back.",
          handled: "They show up as ranks that flap rather than as an error anyone can see, so the packing scheme is kept well inside the 53-bit budget.",
        },
      },
    },
    {
      id: "e5",
      from: "zset-primary",
      to: "read-replicas",
      tier: "data",
      label: "async replication",
      detail: {
        what: "The replication stream carrying every accepted write from the primary out to the read replicas.",
        why: "It is async because rank reads tolerate sub-second staleness against a 5s visibility budget. Synchronous replication would put replica acknowledgement on the write path, already the tightest resource in the system.",
        numbers: [
          { value: "under 1s lag in steady state", explain: "Typical replication delay; comfortably inside the 5s visibility budget the whole write path is sized against." },
          { value: "route reads away above 500ms", explain: "The threshold at which a replica is pulled from serving reads, since past this point staleness becomes visible to a player." },
        ],
        breaks: {
          failure: "Lag spikes behind a snapshot fork, and a lagging replica answers confidently rather than failing.",
          handled: "The lag metric has to gate routing directly, since nothing about a stale answer looks wrong from the read path alone.",
        },
      },
    },
    {
      id: "e6",
      from: "leaderboard-svc",
      to: "read-replicas",
      tier: "hot",
      step: 5,
      label: "ZREVRANK, exact head",
      detail: {
        what: "The exact rank read: one ZREVRANK against a replica for a player inside the top 10,000, plus ZREVRANGE for the top-N slice.",
        why: "This is the query the whole design exists for. It goes to a replica rather than the primary because it is read-only and because the primary's budget is spent on span maintenance under the write burst.",
        numbers: [
          { value: "~50 microseconds server-side", explain: "0.05ms against a 100ms p99 budget — the query itself is nowhere near the constraint; the margin exists to absorb network and serialisation, not this call." },
          { value: "round trip under 5ms", explain: "The typical latency for the whole read, including the network hop to a replica." },
          { value: "p99 budget 100ms", explain: "The SLO this edge must meet; the ~50-microsecond query leaves enormous headroom for tail latency elsewhere in the path." },
        ],
        breaks: {
          failure: "Per-player rank cannot be shared between users, so there is nothing to cache.",
          handled: "The only lever available is more replicas or fewer requests, which is why pushing rank changes over an existing connection is the design's stated escape hatch.",
        },
      },
    },
    {
      id: "e7",
      from: "read-replicas",
      to: "quantile-snapshots",
      tier: "control",
      label: "score distribution, 60s",
      detail: {
        what: "A periodic pass over the board that produces the bucket boundaries and counts making up the quantile summary.",
        why: "It is built from a replica rather than the primary, so a full-board summarisation never competes with the write path. It is periodic because the shape of a 100M-player distribution does not move meaningfully inside a minute.",
        numbers: [
          { value: "refreshed every 60s", explain: "How often the pass over the board runs; frequent enough that the bucket boundaries never drift far from the live distribution." },
          { value: "~200 buckets held in the API process", explain: "100M players ÷ ~200 buckets ≈ 500k players per bucket — coarse enough that no player two ranks apart could ever tell their bucket differs." },
        ],
        breaks: {
          failure: "The summary drifts from the board between refreshes, which is fine in the tail and fatal in the head.",
          handled: "This feed may never be the source for a top-N answer, since even a small drift near the head would misplace the podium.",
        },
      },
    },
    {
      id: "e8",
      from: "quantile-snapshots",
      to: "leaderboard-svc",
      tier: "control",
      label: "bucket for deep ranks",
      detail: {
        what: "The fallback answer for a player outside the top 10,000: a percentile band such as 'top 3%, about 4.2M' rather than an exact position.",
        why: "It collapses the most expensive read shape into an array lookup already resident in the API process. The API contract also carries an explicit exact flag, so the client renders a band rather than a number it would otherwise trust.",
        numbers: [
          { value: "one in-process lookup", explain: "The entire cost of a bucketed answer, an array index rather than any round trip to Redis." },
          { value: "1 boolean exactness flag carried in every response", explain: "The contract detail that stops a client from ever confusing a precise rank with a percentile band." },
        ],
        breaks: {
          failure: "If the client ignores the exact flag it renders an approximate figure as a precise rank.",
          handled: "That is a worse lie than showing a band, which is why the flag is a required field in the response rather than an optional hint.",
        },
      },
    },
    {
      id: "e9",
      from: "leaderboard-svc",
      to: "board-keys",
      tier: "control",
      label: "resolve board key + TTL",
      detail: {
        what: "Turning a logical board request into a concrete key: scope, period and region resolved to lb:daily:2026-04-27 or lb:region:{country}.",
        why: "Keeping the resolution in one place is what makes the midnight rollover a naming decision rather than a distributed state change. It is also where the UTC definition of 'daily' is enforced for every caller.",
        numbers: [
          { value: "5 boards written per match completion", explain: "The fan-out this resolution step feeds; each of the five keys is resolved here before any write happens." },
          { value: "next key created 5 minutes early", explain: "The lead time before a period boundary that this service is responsible for honouring." },
        ],
        breaks: {
          failure: "Defining the day in the player's local timezone instead of UTC puts a player in Auckland and one in Los Angeles on different boards.",
          handled: "The two can then never be compared, which is why every period boundary is resolved against UTC regardless of where a player is.",
        },
      },
    },
    {
      id: "e10",
      from: "event-log",
      to: "score-history",
      tier: "data",
      label: "authoritative history",
      detail: {
        what: "The same log consumed a second time, into the durable relational record of scores and their provenance.",
        why: "Two consumers read off one log rather than one writing to the other. The durable copy does not depend on the in-memory one being correct. A payout can be computed at a sequence boundary rather than read off a board that is only eventually right.",
        numbers: [
          {
            value: "1 log sequence number settles any payout dispute",
            explain: "The unit both the live board and the durable record can be checked against, since only the log guarantees an unambiguous order.",
          },
        ],
        breaks: {
          failure: "This consumer can lag independently of the board writer.",
          handled: "For a window the visible standings and the payable record disagree, and only the record is allowed to settle the difference, never the board.",
        },
      },
    },
    {
      id: "e11",
      from: "zset-primary",
      to: "aof-snapshots",
      tier: "data",
      label: "AOF everysec + RDB",
      detail: {
        what: "Every accepted command appended to the AOF, with a full RDB snapshot taken hourly from a non-serving replica.",
        why: "It bounds the recovery point to about a second, and the cold-start time to an hour of replay. That is the difference between a promotion taking 30s and a rebuild taking tens of minutes.",
        numbers: [
          { value: "~25GB/day of AOF", explain: "× 30 days ≈ 750GB uncompressed, compacting to ~190GB — cheap enough to retain a month, not cheap enough to be the long-term record instead of score-history." },
          { value: "~190GB for 30 days compressed", explain: "What a month of AOF costs to retain; the reason it is not kept as the long-term record on its own." },
          { value: "~1s recovery point", explain: "The maximum write loss on a primary crash, bounded by the everysec fsync policy." },
        ],
        breaks: {
          failure: "If fsync fails on a full disk the correct behaviour is to stop acknowledging writes.",
          handled: "Acknowledging writes that are not actually durable is worse than refusing them, so a full disk has to page rather than fail silently.",
        },
      },
    },
    {
      id: "e12",
      from: "aof-snapshots",
      to: "zset-primary",
      tier: "data",
      label: "restore on cold start",
      detail: {
        what: "Loading the most recent snapshot back into a primary, then replaying the AOF tail on top of it.",
        why: "The snapshot is what keeps a cold start bounded, and this edge is quietly load-bearing despite the design calling it optional. Without it, the honest recovery time for the all-time board is hours rather than minutes.",
        numbers: [
          { value: "1 hourly snapshot bounds the replay", explain: "The most AOF a cold start ever has to replay on top of the loaded snapshot." },
          { value: "9GB board, single-threaded load", explain: "The single-threaded load of this 9GB dwarfs the AOF replay, why snapshot restore takes tens of minutes while replica promotion takes 30s instead." },
        ],
        breaks: {
          failure: "Snapshot loading is single-threaded, so a 9GB board is tens of minutes of unavailability.",
          handled: "That number is nowhere near the 30s replica promotion everyone quotes, which is why promotion, not snapshot restore, is the real recovery path.",
        },
      },
    },
    {
      id: "e13",
      from: "score-history",
      to: "board-writer",
      tier: "control",
      label: "replay to rebuild board",
      detail: {
        what: "The rebuild path: replaying history through the same writer that serves live traffic, to reconstruct a board from scratch.",
        why: "It goes through the writer rather than around it, so the rebuild uses exactly the same batching and packing logic as the live path. That is the only way a rebuilt board is guaranteed to order identically to the one it replaces.",
        numbers: [
          { value: "~250M writes for the all-time board", explain: "The replay volume a full rebuild requires; the same total as the event log's lifetime write count for that board." },
          { value: "~100k/s replay, tens of minutes", explain: "The achievable replay rate and the resulting wall-clock time for a from-scratch rebuild." },
        ],
        breaks: {
          failure: "The rebuild is slower than anyone has agreed to and needs retention covering the board's whole lifetime.",
          handled: "The snapshot ends up carrying the recovery story in practice, since a full replay is reserved for disasters rather than routine recovery.",
        },
      },
    },
  ],
};
