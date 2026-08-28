import type { Diagram } from "./types";

export const TRENDING_TOPICS: Diagram = {
  id: "trending-topics",
  title: "Trending Topics",
  question: "Design Trending Topics / Top-K in a Stream",
  sourceId: "patterns",
  itemId: 53,
  overview: {
    shape:
      "A counting tier whose memory is fixed by the error you accept rather than by how many keys exist, feeding a once-a-minute ranking tier that scores each key against its own history, with the answer materialised into a cache so the read path computes nothing.",
    beats: [
      "Start with the arithmetic that kills the obvious design. Roughly 1.4M distinct keys arrive per minute, a hash-map entry costs about 106B, and a sliding day needs all 1,440 minute deltas resident so you know what to subtract when a minute ages out. That is ~216GB per geography and ~40TB across ~200 of them, so exact counting is gone before you have chosen a structure.",
      "What fits is a fixed grid of counters: 7 rows of 32,768, ~917KB, each key addressed by one hash per row. It stores no strings, so memory is independent of cardinality, and every collision only ever adds, so reading back the minimum of the 7 cells gives an estimate that is never below the truth and at most epsilon times the window volume above it.",
      "The grid cannot enumerate its own keys, because a hash does not invert, so each worker keeps a bounded min-heap of 500 key strings beside it. That splits the answer across two mechanisms with different failure modes, which is where the classic bug lives: merge the shards' local top lists and a key ranked 51st everywhere disappears globally with no error signal anywhere.",
      "Linear mergeability is what makes the whole topology legal. Two sketches of the same shape add cell by cell exactly, so 60 minute tiles sum to an hour, 64 shard tiles sum to the global grid, a tail minute is removed by subtraction, and a region ships 917KB a minute instead of its events. It is also why the conservative-update optimisation is banned, because it makes cells path-dependent.",
      "Ranking is the actual product and it is a separate problem. Rank by volume and the same famous terms win every day, so each candidate is scored against its own EWMA baseline: a steady term at 10,000/min reading 10,500 scores z = 0.33 and is ignored, while a term at 10/min reading 500/min scores z = 122. Keys born inside the window need an absolute floor, a prior and an age damper or anything new goes straight to the top.",
      "All the expensive work runs once a minute for everyone. The merger sums 14.7M cells, re-estimates ~32,000 candidates, joins only the surviving 500 against baselines, and writes a 50-entry blob per geo and window. The read is a single GET at ~2ms against a list that is at most ~10s stale, and the API can never answer 'exactly how many'.",
    ],
    crux:
      "You have to choose the error before you choose the structure, and the only error worth defending is one that is one-sided and survives being combined 3,840 times before anything is published. Everything else follows: the minimum rather than the mean, sketches merged rather than ranked lists merged, and an API that publishes an interval because there is no ground truth anywhere to reconcile against.",
    numbers: [
      "~150MB of sketch ring vs ~216GB of exact map",
      "d = 7, w = 32,768, ~917KB per minute tile",
      "~6.1% relative error at rank 50",
    ],
  },
  nodes: [
    {
      id: "counting-tier",
      label: "Counting tier: memory fixed by error, not cardinality",
      kind: "zone",
      x: 24,
      y: 204,
      w: 672,
      h: 218,
      detail: {
        what: "The fixed-memory half of the system: the de-dup filter, the counter grid and the candidate heap that together turn 1M events/s into ~917KB a minute.",
        why: "Nothing in here is allowed to grow with the number of distinct keys, because the keys are discovered from the traffic rather than registered anywhere. Every structure in this box is sized by an error target or a constant you choose, which is what makes the tier survive an unbounded key space at all.",
        numbers: ["~1.4M distinct keys/min", "~917KB sketch + ~26KB heap + ~11MB filter per shard"],
        breaks:
          "Nothing in the box can prove a number. It publishes an upper bound over a de-duplicated event set, and no downstream consumer can tell those two qualifications apart.",
        choice: {
          pick: "Fixed-size probabilistic state per shard, sized from the error target",
          instead: "An exact hash map per minute per geography, which is what you would write first.",
          decider:
            "Memory for a window that has to slide. ~1.4M distinct keys/min at ~106B per map entry is ~150MB per minute, and a 24-hour sliding window needs all 1,440 minute deltas resident to subtract the tail, so ~216GB per geo and ~40TB across ~200 geos. The same coverage in sketches is ~150MB per geo, a ~1,400x reduction.",
          flips:
            "When the key space is registered before the first event arrives, as with the ~5M ad IDs in #18, where exact per-key state is affordable and the counts are billable so approximation is not on the table.",
        },
      },
    },
    {
      id: "ingest",
      label: "Ingest + normalise",
      sub: "lowercase, strip, fold confusables",
      kind: "service",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The stateless tier that turns a raw post into a countable key: lowercase, strip punctuation, collapse unicode confusables, stamp geo, and emit onto the stream.",
        why: "Whatever this step produces is the key space, so it defines what every structure downstream is sized against. It also has to run before partitioning, because the partition key must be the normalised key or one term's counts scatter across all 64 shards and no shard's estimate is complete.",
        numbers: ["~1M events/s peak, ~29B events/day", "~72B per event, ~2.1TB/day raw"],
        breaks:
          "A normalisation regression that splits one term into variants, #Eclipse against #eclipse, halves both counts and drops the term off the list with no error raised anywhere.",
        choice: {
          pick: "Normalise at ingest, ahead of partitioning, with new versions shadow-run for an hour",
          instead: "Normalising inside the sketch worker, after the event has already been partitioned.",
          decider:
            "Where the partition key comes from. Partitioning on the raw string spreads one logical key over 64 shards, so no shard sees enough of it to nominate it and the heap goes blind in exactly the mid-range where the rank-50 cutoff sits. The cutover gate is top-50 overlap between old and new normalisers: roll back below 90%.",
          flips:
            "A registered key vocabulary, where the key arrives as an id rather than a string and there is nothing to normalise.",
        },
      },
    },
    {
      id: "stream",
      label: "Event stream",
      sub: "Kafka, partitioned by hash(key), 24h",
      kind: "queue",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "A durable, replayable log carrying {key, user_id, ts, geo} at 1M events/s, partitioned so that every occurrence of one key lands on one shard.",
        why: "Key-hash partitioning is not there for the counts, which merge correctly under any partitioning because a cell address depends on the key and not on which worker incremented it. It is there for candidate discovery: a shard can only nominate a key it has seen enough of to believe is heavy.",
        numbers: ["1M events/s peak", "~2.1TB/day raw, RF=3 -> ~6.3TB/day", "24h retention covers the longest window"],
        breaks:
          "A viral key at 200k events/s pins one partition and saturates a single worker while the other 63 idle.",
        choice: {
          pick: "Kafka partitioned by hash(key), 24h retention",
          instead: "Round-robin partitioning, which spreads the hot key perfectly evenly.",
          decider:
            "What happens to nomination. Under round robin each of the 64 shards sees 1/64th of a key's traffic, so local estimates are 1/64th of the truth and heap nomination collapses in the mid-range. The counts are unaffected either way because the cell-wise merge reassembles them.",
          flips:
            "Hybrid, per key: when the skew monitor sees hottest-shard rate over median above 2x, round-robin just that key. Anything hot enough to trigger that is still enormous at 1/64th of its volume, so it is nominated regardless.",
        },
      },
    },
    {
      id: "archive",
      label: "Raw archive",
      sub: "Parquet on object store, replay + audit",
      kind: "database",
      x: 440,
      y: 110,
      w: 240,
      detail: {
        what: "Every raw event and every published list, written as Parquet partitioned by day.",
        why: "It is the only ground truth anywhere in the system. A key that appeared four minutes ago has no reconciliation target except the stream itself, so replay after a lost minute, review of a suppression decision, and any exact recount all start here.",
        numbers: ["~2.1TB/day raw", "recount affordable only over the ~500 published candidates"],
        breaks:
          "The recount it enables does not close the gap. It lands minutes after the list it describes and over a slightly different event set once late arrivals have landed, so it will disagree with the published estimate often enough to notice.",
        choice: {
          pick: "Parquet on object storage for both raw events and published lists",
          instead: "Relying on the stream's own 24h retention as the entire recovery and audit story.",
          decider:
            "The longest window is 24h, so the stream sits exactly at the edge with no margin, and a suppression appeal or a newsroom query arrives days after the events behind it have aged out. Audit rows are also tiny next to raw events, so retaining lists forever is nearly free.",
          flips:
            "Deployments with no appeal or review obligation and no exact-count requests, where 24h of stream retention covers replay and nothing else needs keeping.",
        },
      },
    },
    {
      id: "dedupe",
      label: "De-dup Bloom",
      sub: "rotating 5-min generations, per shard",
      kind: "database",
      x: 440,
      y: 220,
      w: 240,
      detail: {
        what: "A rotating Bloom filter over (user_id, key) tuples for the current 5-minute generation, tested and set before any counter moves.",
        why: "Raw volume has to mean distinct participants or one account with a loop is a trend. Capping each account at one count per key per window is the cheapest bot resistance available and it runs on the hot path for the price of a few memory probes.",
        numbers: ["300M tuples per 5-min generation", "1% FPR -> 9.6 bits/element -> ~360MB", "x2 rotating generations ~720MB, ~11MB/shard"],
        breaks:
          "It deletes real events. At 1% false positives roughly 1% of genuine pairs never reach a counter, concentrated late in a generation when the filter is fullest, so the sketch's clean 'never under-counts' guarantee holds over de-duplicated events rather than over reality.",
        choice: {
          pick: "Rotating Bloom at a 1% false-positive rate, sized for 2x peak",
          instead: "Exact per-user sets, or the same filter tuned to 0.1%.",
          decider:
            "300M (user, key) tuples per generation. Exact sets at that count are unaffordable, and dropping to 0.1% costs 50% more memory to reduce a bias nobody can measure, because there is no ground truth for how many de-duplications were wrong. Rotate a generation early when fill crosses 80%.",
          flips:
            "Per-tenant or low-rate deployments where a generation holds a few million tuples and an exact set fits, removing the undercount entirely.",
        },
      },
    },
    {
      id: "sketch-worker",
      label: "Sketch workers x 64",
      sub: "Count-Min d=7 · w=32,768 · ~917KB",
      kind: "service",
      x: 40,
      y: 260,
      w: 280,
      detail: {
        what: "Each worker consumes its partitions, hashes every key once per row, increments those 7 counters, and reads the minimum back as the running estimate.",
        why: "The dimensions are derived, not chosen: w sets the size of the error at e/w, d sets the probability the bound holds at e^-d. Taking the minimum rather than the mean is what keeps the error one-sided, because every row is contaminated upward and the minimum is the least-collided sample rather than an average of the noise.",
        numbers: [
          "7 writes, ~50ns per event; ~15.6k events/s/shard, ~110k counter writes/s",
          "epsilon = 8.3e-5, delta = 0.001, so epsilon*N ~ 4,980 on a 60M-event minute",
          "3 rows of 1M would give delta = e^-3, one estimate in 20 outside the bound entirely",
        ],
        breaks:
          "Over-promotion near the cutoff. Relative error at rank 50 is ~6.1% on a minute window and ~7.9% on a day, enough to reshuffle ranks 45 to 55 between refreshes, which reads to a user as a broken product unless hysteresis holds the boundary.",
        choice: {
          pick: "Count-Min sketch, plain increments, d = 7 and w = 32,768",
          instead: "Space-Saving over a Stream-Summary, or Count-Min with conservative update.",
          decider:
            "How many times a partial result is combined before publication. One 1-hour list is 64 shards across 60 tiles, so 3,840 combining operations. Count-Min adds exactly, so all 3,840 are lossless; Space-Saving merges are heuristic and compound with no error signal, and conservative update makes cells path-dependent so they stop summing at all. Accuracy is a wash: 6,000 against 4,980 at equal memory.",
          flips:
            "A single aggregator with no cross-shard merge, roughly anything under 100k events/s, where Space-Saving carries the key strings and a per-key error bound for free and the heap becomes dead weight.",
        },
      },
    },
    {
      id: "heap",
      label: "Per-shard top-500 heap",
      sub: "the only place key strings live",
      kind: "database",
      x: 440,
      y: 330,
      w: 240,
      detail: {
        what: "A bounded min-heap of (key, current estimate) per shard, capped at 10x K, offered every key the worker processes.",
        why: "The grid threw the strings away and a hash does not invert, so something has to supply candidates for the sketch to rank. Capping at 10x K rather than K puts the local cutoff far below the global one, which is what stops a globally heavy key being cut on a shard that happens to own several heavier ones.",
        numbers: ["500 entries per (geo, window), ~26KB", "union of 64 heaps ~32,000 candidates"],
        breaks:
          "It owns discovery, not counting. A key that no worker ever believed was heavy can never be ranked, whatever the merged sketch would have said about it.",
        choice: {
          pick: "Heaps merged as a candidate set only, then every candidate re-estimated against the merged sketch",
          instead: "Merging the 64 shards' local top-50 lists straight into a global top 50.",
          decider:
            "A key ranked 51st on every one of 64 shards can be globally first, and merging lists loses it silently. The candidate set is allowed to be lossy because a key outside the top 500 on every shard cannot plausibly be globally top-50 under Zipf; the counts used to rank it are not, which is why re-estimation is mandatory.",
          flips:
            "A single-shard deployment, where the local list is the global list and both the 10x slack and the re-estimation pass are pure overhead.",
        },
      },
    },
    {
      id: "abuse",
      label: "Abuse scorer",
      sub: "ASN · account age · graph density",
      kind: "service",
      x: 440,
      y: 440,
      w: 240,
      detail: {
        what: "An async consumer scoring concentration signals per candidate key and emitting soft demotion flags rather than deletions.",
        why: "Anything publicly ranked is a target, and per-(user, key) de-duplication has already priced out the single scripted account. What is left is many accounts acting together, which only concentration signals across network, account age and follow graph can see at all.",
        numbers: ["demote and queue, never delete", "every decision written to the audit trail", "override rate is the metric that says whether it is working"],
        breaks:
          "It cannot separate 10,000 organised aged accounts from a genuine grassroots event, because both produce regional concentration, dense follow clustering and a burst of accounts created because of the event. Every threshold that catches one catches the other.",
        choice: {
          pick: "Soft suppression with a human review queue and a fast override path",
          instead: "Hard removal above a score threshold.",
          decider:
            "The asymmetry of the two errors. A missed manipulation leaves an artifact you can study; a wrong demote silently kills a breaking story and produces none, so the only measurable signal is a queue with an override rate. There is no content or off-platform signal in this pipeline to separate the two cases.",
          flips:
            "Closed corpora with a registered publisher set, where a hard block is auditable against a known identity and grassroots events do not exist by construction.",
        },
      },
    },
    {
      id: "merger",
      label: "Merger",
      sub: "cell-wise sum · re-estimate candidates",
      kind: "service",
      x: 40,
      y: 430,
      w: 280,
      detail: {
        what: "Once a minute it sums the 64 shard tiles cell by cell, pushes the result into the ring, unions the 64 heaps and re-estimates every candidate against the merged window sketch.",
        why: "Linear mergeability is the crux and this is where it is spent: sketch(A) + sketch(B) = sketch(A union B) exactly, cell by cell, with no approximation introduced by the merge itself. Sliding windows, shard-then-merge and cross-region aggregation are all consequences of that single property.",
        numbers: [
          "64 x 229,376 = ~14.7M integer adds, ~20ms",
          "59MB burst per minute, ~1MB/s of merge traffic",
          "32,000 x 7 = 224k re-probes, ~2ms; publish lag ~550ms against a 10s SLO",
        ],
        breaks:
          "Summing tiles built with different (d, w) or hash seeds after a rolling deploy. They add arithmetically and produce a plausible, entirely meaningless result whose only symptom is rankings that quietly stop making sense, which is why every tile carries a version header the merger refuses to cross.",
        choice: {
          pick: "One designated merger per geo, all shards sealing on the same minute boundary",
          instead: "A hierarchical merge tree, or staggered seals merged incrementally as tiles arrive.",
          decider:
            "The work is not the bottleneck: 14.7M adds is ~20ms and the fan-in is ~1MB/s. 500ms of the 550ms publish budget is sealing and shipping, so a cleverer merge topology buys almost nothing against a 10s staleness SLO.",
          flips:
            "When the 550ms has to shrink or the fan-in grows past one process, where staggered seals and incremental merging are the answer, at the cost of a window boundary fuzzy by a few hundred milliseconds.",
        },
      },
    },
    {
      id: "ring",
      label: "Sketch ring",
      sub: "60 minute tiles + 24 hour tiles per geo",
      kind: "database",
      x: 440,
      y: 550,
      w: 240,
      detail: {
        what: "The per-geo window state: add the newest minute tile to the running window sketch, subtract the tile that fell off the tail.",
        why: "Three named windows come out of one structure because sketches subtract as exactly as they add. You are only ever removing increments you previously added, so no cell can go negative and no expiry pass has to reason about which key contributed what.",
        numbers: [
          "84 tiles x ~1.8MB ~ ~150MB per geo, ~30GB fleet",
          "7.5% of a stated 2GB per-aggregator budget",
          "~150MB of ring against ~216GB of exact map for the same coverage",
        ],
        breaks:
          "Dimension explosion. 200 geos is comfortable, but adding language and platform multiplies combinatorially and 30GB becomes 3TB, so only the served combinations can be materialised.",
        choice: {
          pick: "A ring of per-minute and per-hour tiles",
          instead: "One exponentially decayed sketch per geo, every cell multiplied by 0.98 each minute for a ~34-minute half-life.",
          decider:
            "150MB against 1.8MB is 83x, but it is measured against a 2GB per-aggregator budget the ring uses 7.5% of, so memory is not scarce enough to buy a structure that cannot answer 'exactly the last 5 minutes'. The product ships three named windows and a rank_delta between refreshes, and both need crisp boundaries.",
          flips:
            "When the dimension you multiply by is large: 50,000 tenants, or one sketch per (geo, language, platform), where 1.8MB against 150MB decides it immediately and there is no boundary artefact either.",
        },
      },
    },
    {
      id: "scorer",
      label: "Trend scorer",
      sub: "z vs baseline · floor · prior · damper",
      kind: "service",
      x: 40,
      y: 550,
      w: 280,
      detail: {
        what: "Joins the surviving top 500 candidates against their baselines and ranks by z = (r_short - mu) / max(sigma, sigma_floor).",
        why: "Trending means rate of change, not volume. Rank by raw count and the same famous terms win every day, because a term that is always enormous is background rather than news, which is the entire difference between this and a leaderboard.",
        numbers: [
          "mu = 10,000/min, sigma = 1,500, reading 10,500 -> z = 0.33, ignored",
          "mu = 10/min, sigma = 4, reading 500/min -> z = 122",
          "floor >= 500 counts in 5 min; prior mu0 = 1/min, sigma0 = 2; damper min(1, age_min/15)",
        ],
        breaks:
          "Cold start. A key born inside the window has no history at all, and without the floor, the prior and the age damper anything brand new takes the top slot on a few hundred counts and holds it for one refresh.",
        choice: {
          pick: "Per-key EWMA of rate and variance at a 7-day half-life, plus a minute-of-day profile for the top keys",
          instead: "Pure sketch arithmetic: (count_5m / 5) divided by (count_24h / 1440), with no baseline store at all.",
          decider:
            "What the ratio does to a key born inside the window. Its 24-hour count equals its 5-minute count, so the ratio is exactly 1440/5 = 288 for every new key regardless of size: a 500-count key ties a 500,000-count key at the top and the expression has nowhere to put a prior. The baseline form has an explicit slot for one, at ~290MB.",
          flips:
            "When the baselines would be mostly empty anyway, inside a live event or a market launched last week, where you pay 290MB and a join to read back a constant. The ratio is the outage fallback regardless, so it is code you write either way.",
        },
      },
    },
    {
      id: "baselines",
      label: "Baseline store",
      sub: "Redis/KV, EWMA rate + variance",
      kind: "database",
      x: 440,
      y: 660,
      w: 240,
      detail: {
        what: "Per key, an EWMA of its rate, an EWMA of its variance, and a 1,440-slot minute-of-day profile for the top keys.",
        why: "This is the only thing in the system that converts 'high' into 'unusually high'. Without it the ranking has no notion of normal, and no amount of counting accuracy tells you whether 10,500 a minute is a story or a Tuesday.",
        numbers: ["7-day half-life", "~100k profiled keys x ~2.9KB ~ ~290MB", "500 gets per cycle, ~5ms pipelined"],
        breaks:
          "Join amplification. Joining all ~32k candidates every minute per geo is ~100k gets/s fleet-wide, which is why the join happens after truncation and a key rising from deep in the tail waits one extra cycle for its baseline.",
        choice: {
          pick: "Join after truncating to the top 500, with recently trending baselines cached",
          instead: "Joining all ~32k candidates before the sort so every candidate is scored properly.",
          decider:
            "32k gets per minute per geo is ~100k/s fleet-wide against 500 gets at ~5ms pipelined, a ~64x reduction for one cycle of extra latency on keys that were nowhere near the cutoff anyway.",
          flips:
            "Few geos and a small candidate union, where the fleet-wide rate is trivial and scoring every candidate gives a genuinely better cutoff.",
        },
      },
    },
    {
      id: "cache",
      label: "Top-K cache",
      sub: "Redis, trending:{geo}:{window}",
      kind: "database",
      x: 40,
      y: 660,
      w: 280,
      detail: {
        what: "The materialised answer: 50 entries plus an as_of timestamp per (geo, window), rewritten every 5 seconds.",
        why: "The expensive work has to happen once a minute for everyone rather than once per request. If the trending panel computed anything at all it would immediately be the most expensive query in the product, and it is on the first screen of every session.",
        numbers: ["3 windows x ~200 geos x ~5KB ~ ~3MB total", "600 writes per 5s = 120 writes/s", "list at most ~10s stale"],
        breaks:
          "Eviction or a failover leaves the key empty and the panel blank, which is why the API keeps a last known good copy in process and shows staleness rather than nothing.",
        choice: {
          pick: "Precomputed lists in Redis, rewritten on a 5s timer, with the geo fallback chain resolved at write time",
          instead: "Computing the top-K per request from the sketch ring.",
          decider:
            "~17k reads/s average and ~60k/s peak against 120 writes/s, a ratio of roughly 140 to 1. Per-request scoring would be 224k sketch probes plus a 500-key baseline join per read; the materialised form is a single GET at ~2ms p99 against a 20ms SLO.",
          flips:
            "Per-tenant trending with a tiny audience, where the timer burns a cycle a minute on lists nobody opens and computing on demand is cheaper.",
        },
      },
    },
    {
      id: "api",
      label: "Trending API",
      sub: "GET /trending?window=&geo=",
      kind: "service",
      x: 40,
      y: 770,
      w: 280,
      detail: {
        what: "The read tier: one GET against the cache key, plus a per-key drill-down that returns count_est alongside its error_bound.",
        why: "The read path deliberately touches no sketch, so sizing it is a cache problem rather than a streaming problem. The geo fallback chain is resolved at write time too, so a sparse metro never returns an empty panel and the API stays a lookup.",
        numbers: ["~1.5B panel loads/day, ~17k/s avg and ~60k/s peak", "p99 < 20ms SLO, ~2ms served", "list at most ~10s stale"],
        breaks:
          "It cannot answer 'exactly how many'. The sketch returns an upper bound, so the honest surface is an estimate plus a bound and never a figure anyone can reconcile against anything.",
        choice: {
          pick: "Publish count_est with an explicit error_bound",
          instead: "Publishing a bare count, which is what every consumer actually asks for.",
          decider:
            "At ~6.1% relative error at rank 50 the number disagrees with any recount, and a recount over the ~500 published candidates lands minutes later over a slightly different event set. Shipping two numbers for one key at one timestamp, with no principled story about which is 'the' count, is worse than one honest interval.",
          flips:
            "Deployments that first restrict the key space, promoting keys past a floor into a registered set and aggregating those exactly, where a provable count genuinely exists.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "ingest",
      to: "stream",
      label: "normalised key, geo",
      animated: true,
      detail: {
        what: "Normalised events appended to the log as {key, user_id, ts, geo}, keyed for partitioning on the normalised string.",
        why: "Normalisation has to precede the append because the partition assignment is computed from the key here. Get the order wrong and one logical term is split across shards before anything has a chance to count it.",
        numbers: ["~72B per event", "~29B events/day"],
        breaks:
          "Any normalisation change alters the partition assignment for existing keys mid-flight, so a term's counts land on two shards during the rollout and neither is complete.",
      },
    },
    {
      id: "e2",
      from: "stream",
      to: "sketch-worker",
      label: "partition by hash(key)",
      animated: true,
      detail: {
        what: "The hot path: each worker consuming the partitions it owns, ~15.6k events/s per shard.",
        why: "One key on one shard is what makes a local estimate complete, which is what makes a heap nomination mean anything. The counts would merge correctly under any partitioning; the nominations would not.",
        numbers: ["1M events/s across 64 shards", "~15.6k events/s per shard"],
        breaks:
          "A viral key at 200k events/s saturates one consumer while 63 idle, and no amount of fleet helps because the partition is the unit of parallelism.",
      },
    },
    {
      id: "e3",
      from: "stream",
      to: "archive",
      label: "raw events, replay + audit",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A parallel consumer landing every raw event as Parquet, partitioned by day and hour.",
        why: "It is the only durable record beyond the 24h retention, and the 24h window is exactly the longest one served, so there is no margin. Replaying a lost minute into a catch-up worker also happens from here.",
        numbers: ["~2.1TB/day raw", "24h stream retention against a 24h window"],
        breaks:
          "It is drawn dashed because nothing on the serving path waits for it: if the archive falls behind, every published list still looks perfect and the loss shows up only when someone asks for a recount.",
      },
    },
    {
      id: "e4",
      from: "stream",
      to: "abuse",
      label: "user, ASN, graph signals",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 100,
      detail: {
        what: "An independent consumer reading the same events for concentration signals: network origin, account age, follow-graph density.",
        why: "Abuse scoring is deliberately off the counting path, because it is slower and less certain than counting and must never be able to stall a publish cycle. It flags asynchronously and the scorer applies whatever has arrived.",
        numbers: ["async, flags rather than blocks"],
        breaks:
          "Its verdicts arrive on their own schedule, so a manipulation detected after a list has published stays visible until the next refresh.",
      },
    },
    {
      id: "e5",
      from: "sketch-worker",
      to: "dedupe",
      label: "(user, key) test_and_set",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The first thing that happens to an event: a test-and-set of the (user_id, key) tuple against the current 5-minute generation.",
        why: "It sits ahead of the counters so a repeat never reaches them, which is what makes published volume mean distinct participants rather than distinct events.",
        numbers: ["300M tuples per generation", "1% FPR, ~11MB per shard"],
        breaks:
          "This edge deletes traffic. Roughly 1% of genuine pairs are rejected as duplicates, so everything downstream is an upper bound on a lossy sample rather than on reality, and the two errors do not compose into a bound.",
      },
    },
    {
      id: "e6",
      from: "sketch-worker",
      to: "heap",
      label: "offer(key, est)",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "After incrementing, the worker probes the same 7 cells, takes the minimum, and offers (key, estimate) to its bounded heap.",
        why: "This is the only place a key string is retained anywhere in the counting tier. The estimate offered alongside it is already the sketch's answer, so the heap is ordering by the same quantity the merger will later re-derive.",
        numbers: ["capped at 500 = 10x K per shard", "~26KB per (geo, window)"],
        breaks:
          "The offer is made against a per-shard estimate, so a key spread thinly across shards is never offered anywhere and simply cannot be discovered.",
      },
    },
    {
      id: "e7",
      from: "sketch-worker",
      to: "merger",
      label: "sealed 917KB tile, 60s",
      animated: true,
      detail: {
        what: "At the minute boundary the worker seals its grid, ships ~917KB, and starts a fresh one.",
        why: "Shipping counters rather than events is the compression that makes the whole topology affordable: 64 shards produce 59MB a minute instead of the tens of gigabytes of raw traffic behind it. The same trick carries a region's counts cross-region at ~8GB/day against ~2.1TB/day.",
        numbers: ["~917KB per tile, 64 tiles = 59MB/min", "~1MB/s of merge traffic"],
        breaks:
          "All 64 shards seal on the same instant, so the publish cycle blocks on the slowest, and a worker restart loses its in-flight minute entirely and that minute must be replayed and merged in late.",
      },
    },
    {
      id: "e8",
      from: "heap",
      to: "merger",
      label: "500 key strings/shard",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Each shard's 500 candidate strings shipped alongside its sealed tile and unioned into ~32,000 candidates.",
        why: "The merger needs strings it cannot get from the grid. This arrow carries only candidates, never rankings, because the ordering they arrive with is per-shard and about to be thrown away.",
        numbers: ["~26KB per shard", "union ~32,000 candidates"],
        breaks:
          "If this were the merged ranking rather than a candidate set, a key ranked 51st on every shard would vanish from the global list with nothing anywhere reporting an error.",
      },
    },
    {
      id: "e9",
      from: "merger",
      to: "ring",
      label: "push tile, subtract tail",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The merged minute tile added into the running window sketch cell by cell, and the tile from 60 minutes ago subtracted out.",
        why: "This is what a sliding window costs when the structure is linear: two passes over 229,376 cells, no per-key bookkeeping, no decision about which key expired. It works only because addition is exact and subtraction removes increments you previously added.",
        numbers: ["229,376 cells per tile", "60 minute tiles + 24 hour tiles per geo"],
        breaks:
          "It is unforgiving about shape. Adding a tile built with different dimensions or hash seeds corrupts the window silently, since mismatched sketches still sum arithmetically.",
      },
    },
    {
      id: "e10",
      from: "merger",
      to: "scorer",
      label: "~32k re-estimated",
      animated: true,
      detail: {
        what: "Every candidate re-estimated against the merged window sketch, sorted, truncated to the top 500, and handed on for scoring.",
        why: "Re-estimation is the step that makes a lossy candidate set safe. The candidates may be missing keys no shard nominated, but the counts used to order them are now global rather than per-shard.",
        numbers: ["32,000 x 7 = 224k probes, ~2ms", "truncated to 500 before any join"],
        breaks:
          "Skipping this and sorting on the per-shard estimates that arrived with the heaps is exactly the bug the heap slack exists to survive.",
      },
    },
    {
      id: "e11",
      from: "abuse",
      to: "scorer",
      label: "soft demote flags",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Suppression flags applied as a score multiplier at ranking time rather than as a filter at ingest.",
        why: "Demoting at the last possible moment keeps the counting tier free of policy, keeps every decision reversible, and means a wrongly suppressed key is still sitting in the candidate set when a human overrides it.",
        numbers: ["demote, never delete", "every decision to the audit trail"],
        breaks:
          "Flags arriving after a publish apply only from the next cycle, so a manipulated term is visible for up to one refresh, and the same signals fire on genuine grassroots events.",
      },
    },
    {
      id: "e12",
      from: "scorer",
      to: "baselines",
      label: "top 500 baseline join",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "500 pipelined KV gets pulling each surviving candidate's EWMA rate, variance and minute-of-day profile.",
        why: "The join happens after truncation on purpose. Scoring all ~32k candidates would be ~100k gets/s fleet-wide for keys that were never going to make the cut.",
        numbers: ["500 gets, ~5ms pipelined", "~100k gets/s if joined before truncation"],
        breaks:
          "If the store is unavailable the scorer falls back to the short-over-long rate ratio, which needs only sketch probes, and the list is served with a degraded_scoring flag.",
      },
    },
    {
      id: "e13",
      from: "scorer",
      to: "cache",
      label: "top 50 + as_of, every 5s",
      animated: true,
      detail: {
        what: "The finished list written as a small JSON blob per (geo, window), with the geo fallback chain resolved so every key is populated.",
        why: "This is the boundary between the streaming system and the product. Everything upstream is per-minute batch work; everything downstream is a key-value lookup, and the two are sized completely independently.",
        numbers: ["~5KB per list, ~3MB total", "120 writes/s across the fleet"],
        breaks:
          "Hysteresis is applied here: a key must beat the rank-50 score by 10% to enter and fall 10% below to leave, or ~6% counting error flickers the boundary between consecutive refreshes.",
      },
    },
    {
      id: "e14",
      from: "cache",
      to: "api",
      label: "single GET, ~2ms p99",
      animated: true,
      detail: {
        what: "The entire read path: one key-value lookup returning a precomputed list plus its as_of timestamp.",
        why: "The panel is on the first screen of every session, so the read has to be the cheapest thing in the system. Anything computed per request would make trending the most expensive query in the product by an order of magnitude.",
        numbers: ["~17k/s average, ~60k/s peak", "~2ms p99 against a 20ms SLO"],
        breaks:
          "An empty key after eviction returns a blank panel, so the API holds a last known good copy in process and surfaces the staleness instead.",
      },
    },
  ],
};
