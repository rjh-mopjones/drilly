import type { Diagram } from "./types";

export const TRENDING_TOPICS: Diagram = {
  id: "trending-topics",
  title: "Trending Topics",
  question: "Design Trending Topics / Top-K in a Stream",
  sourceId: "patterns",
  itemId: 53,
  overview: {
    shape:
      "Count everything approximately in fixed memory, merge the counts once a minute, rank each key against its own normal, and precompute the answer so a read is one lookup.",
    forces: [
      {
        constraint: "~1.4M distinct keys a minute, and a 24h window that has to slide",
        decision: "Count in a fixed grid of counters (a count-min sketch) inside the Sketch workers, never in a hash map",
        lights: ["sketch-worker", "ring"],
      },
      {
        constraint: "1M events/s over 64 shards, but one answer per geo",
        decision: "Each shard ships a 917KB tile of counters to the Merger once a minute, not its events",
        lights: ["sketch-worker", "merger", "e7"],
      },
      {
        constraint: "A hash cannot be reversed: the grid holds 229,376 counters and 0 key names",
        decision: "A Per-shard top-500 heap keeps the strings; the Merger re-estimates every candidate against the merged grid",
        lights: ["heap", "merger", "e8", "e10"],
      },
      {
        constraint: "The same famous terms run at ~10,000/min every single day",
        decision: "The Trend scorer ranks by surprise against each key's own Baseline store, not by volume",
        lights: ["scorer", "baselines", "e12"],
      },
      {
        constraint: "~60k panel loads/s at peak against a 20ms p99",
        decision: "The list is precomputed into the Top-K cache every 5s; the Trending API does one GET",
        lights: ["cache", "api", "e13", "e14"],
      },
    ],
    naive: {
      text: "Keep a hash map of key → count for every minute and every geo, and rank by count. The map is the problem. About 1.4M distinct keys arrive a minute and a map entry costs ~106B, so one minute is ~150MB. A 24h window that slides must keep all 1,440 minute maps, because it has to know what to subtract when a minute ages out. That is ~216GB per geo and ~40TB across ~200 geos, before any replication. Merging 64 shards' maps also means shipping every key string across the network each minute. The Sketch workers replace the map with a grid that costs 917KB a minute whatever the key count, and the Sketch ring holds a whole day in ~150MB.",
      lights: ["sketch-worker", "ring"],
    },
    beats: [
      {
        text: "A key is whatever we count: a hashtag, a phrase, a link. Ingest + normalise turns each raw post into a key by lowercasing, stripping punctuation and collapsing look-alike unicode characters, then stamps a geo. It appends {key, user_id, ts, geo} to the Event stream. The stream is partitioned by hash(key), so every occurrence of one key lands on the same shard. That matters later: a shard can only nominate a key it has seen all of.",
        lights: ["ingest", "stream", "e1", "e2"],
      },
      {
        text: "Each of the 64 Sketch workers counts with a count-min sketch. A count-min sketch is a grid of counters: d = 7 rows, w = 32,768 columns, ~917KB. To count a key, hash it once per row and add 1 to the 7 cells that come out. To read a key, look at the same 7 cells and take the minimum. Collisions only ever add, so every cell is at or above the truth and the minimum is the least-polluted one. The answer is never below the true count and at most ~5,000 above it on a 60M-event minute. The grid stores no strings, so its size never depends on how many keys exist. Before counting, a Bloom filter of (user_id, key) pairs drops repeats, so one user is one vote.",
        lights: ["sketch-worker", "e2"],
      },
      {
        text: "The grid can answer 'how many times did #eclipse appear' but not 'which keys are big', because a hash does not reverse. So each worker also keeps a Per-shard top-500 heap: a small sorted list of the 500 largest keys it has seen, as strings, each with its current estimate. Why 500 and not 50? A key ranked 51st on every one of 64 shards could be first in the world. Keeping 10× K per shard puts the local cutoff far below the global one, so a globally big key is nominated somewhere.",
        lights: ["heap", "e6"],
      },
      {
        text: "At every minute boundary a worker seals its grid into a tile, ships the 917KB to the Merger, and starts a fresh grid. The Merger adds the 64 tiles cell by cell: 64 × 229,376 = ~14.7M integer additions, about 20ms. This works because a sketch of A plus a sketch of B is exactly the sketch of A ∪ B, with no error added by the merge. The Merger also unions the 64 heaps into ~32,000 candidate strings and re-estimates each one against the merged grid: 32,000 × 7 = 224k probes, ~2ms. The 500 largest survive. The heaps supply names; the merged grid supplies the counts.",
        lights: ["merger", "e7", "e8", "e10"],
      },
      {
        text: "The Sketch ring turns tiles into windows. Because sketches add exactly, they also subtract exactly, so a 5-minute window is the sum of 5 minute tiles and a 1-hour window is 60 of them. To slide, add the newest tile and subtract the one that just fell off the tail. A day is 24 hour tiles. Each geo keeps 60 minute tiles and 24 hour tiles at ~1.8MB each, about 150MB, against the ~216GB an exact map would need.",
        lights: ["ring", "e9"],
      },
      {
        text: "Trending means unusually high, not high, so the Trend scorer ranks by surprise. The Baseline store holds, per key, an EWMA of its rate and of its variance. An EWMA is a running average that forgets the past on a 7-day half-life. The score is z = (rate now − usual rate) ÷ usual spread. A term that always runs at 10,000/min and reads 10,500 scores z = 0.33 and is ignored. A term that usually runs at 10/min and reads 500 scores z = 122 and tops the list. Brand-new keys have no history, so three guards stop them winning on 200 counts. A floor of 500 counts in 5 minutes, a prior of 1/min, and an age damper that reaches full weight at 15 minutes. The Abuse scorer applies a multiplier between 0 and 1 for suspected manipulation; it never deletes.",
        lights: ["scorer", "baselines", "abuse", "e11", "e12"],
      },
      {
        text: "All the expensive work happens once a minute for everyone. The scorer writes a 50-entry list per (geo, window) into the Top-K cache every 5 seconds, ~3MB in total. The Trending API answers a panel load with one GET at ~2ms, and the list is at most ~10s stale. Each entry carries count_est and an error_bound, because the grid can only promise an upper bound.",
        lights: ["cache", "api", "e13", "e14"],
      },
      {
        text: "The budget adds up like this. Sealing and shipping 64 tiles is ~500ms, the merge ~20ms, re-estimation ~2ms, the baseline join ~5ms, the cache write under 1ms. That is ~550ms from minute boundary to a fresh list, against a 10s staleness target. On the read side, one GET at ~2ms sits inside a 20ms p99. No read ever touches a sketch, which is why the two sides are sized independently.",
        lights: ["merger", "scorer", "cache", "e10", "e13"],
      },
    ],
    crux: {
      problem:
        "Nothing in the system can prove a count, and the answer is assembled from 64 partial views. Two things can go silently wrong. A key can be globally top-50 yet never big enough on any one shard to be nominated. And every published count is an upper bound with no ground truth to check it against.",
      handled:
        "Nomination slack fixes the first. Each shard nominates 500 keys, 10× the list size, and the Merger re-estimates every candidate against the merged grid. A key that is big on many shards is therefore found, and ranked on global counts. The second is contained rather than fixed. The error is one-sided, at most ~5,000 over on a 60M-event minute, and the API publishes count_est with its error_bound instead of pretending. Hysteresis holds the rank-50 boundary so the ~6% error does not flicker the list. What remains: a key spread so thinly that no shard ranks it in its top 500 stays invisible. The only fix is a periodic exact pass over the Raw archive, which lands minutes late.",
    },
    numbers: [
      {
        value: "~216GB per geo for an exact map",
        explain:
          "1.4M distinct keys/min × ~106B per hash-map entry ≈ 150MB per minute. A sliding 24h window keeps all 1,440 minute maps to know what to subtract, so 1,440 × 150MB ≈ 216GB per geo and ~40TB across 200 geos. This is the number that rules out exact counting.",
      },
      {
        value: "917KB per minute tile",
        explain:
          "7 rows × 32,768 counters × 4 bytes = 917,504 bytes. Fixed whatever the key count. 64 shards ship 64 × 917KB = 59MB a minute, ~1MB/s, instead of the events behind it.",
      },
      {
        value: "≤ ~5,000 over-count on a 60M-event minute",
        explain:
          "A count-min sketch over-counts by at most ε × N with probability 1 − δ. Here ε = e ÷ w = 2.718 ÷ 32,768 ≈ 8.3e-5, and δ = e^-d = e^-7 ≈ 0.001. With N = 60M events in the minute, ε × N ≈ 4,980. The error is one-sided: never under.",
      },
      {
        value: "~6.1% relative error at rank 50",
        explain:
          "The 50th key in a busy geo runs at roughly 82k events/min, so a ~5,000 bound is 5,000 ÷ 82,000 ≈ 6.1%. That is enough to reshuffle ranks 45 to 55 between refreshes, which is why the cache write applies hysteresis.",
      },
      {
        value: "~550ms publish cycle vs 10s SLO",
        explain:
          "Seal + ship 64 tiles ~500ms, merge 14.7M cells ~20ms, re-estimate 32k candidates ~2ms, join 500 baselines ~5ms, write ~1ms. The whole minute cycle fits in ~5% of the staleness budget, so a cleverer merge topology buys nothing.",
      },
    ],
  },
  nodes: [
    {
      id: "counting-tier",
      label: "Counting tier: memory fixed by error, not cardinality",
      kind: "zone",
      detail: {
        what: "The fixed-memory half of the system: the de-dup filter, the counter grid and the candidate heap that turn 1M events/s into ~917KB a minute.",
        why: "Keys are discovered from the traffic, not registered anywhere, so nothing in here may grow with the number of distinct keys. Every structure in this box is sized by an error target or a constant you choose. That is what lets the tier survive an unbounded key space.",
        numbers: [
          {
            value: "~1.4M distinct keys/min",
            explain: "Measured cardinality per geo per minute; the figure an exact map would have to hold and the sketch never sees.",
          },
          {
            value: "~917KB sketch + ~26KB heap + ~11MB filter per shard",
            explain:
              "Grid 7 × 32,768 × 4B = 917KB. Heap 500 entries × ~52B = 26KB. Bloom filter for 300M (user, key) pairs at 1% false positives ≈ 11MB across two rotating generations. About 12MB of state per shard, none of it proportional to key count.",
          },
        ],
        breaks: {
          failure:
            "Nothing in the box can prove a number. It publishes an upper bound over a de-duplicated event set, and no downstream consumer can tell those two qualifications apart.",
          handled:
            "The API publishes count_est with an explicit error_bound rather than a bare figure. The Raw archive keeps the events, so a recount over the ~500 published candidates is possible when someone needs a defensible number. Exact counts for every key would need the map this tier exists to avoid.",
        },
        choice: {
          pick: "Fixed-size probabilistic state per shard, sized from the error target",
          instead: "An exact hash map per minute per geography, which is what you would write first.",
          decider:
            "Memory for a window that has to slide. ~1.4M distinct keys/min at ~106B per map entry is ~150MB per minute. A 24-hour sliding window needs all 1,440 minute deltas resident to subtract the tail, so ~216GB per geo and ~40TB across ~200 geos. The same coverage in sketches is ~150MB per geo, a ~1,400x reduction.",
          flips:
            "When the key space is registered before the first event arrives, as with a fixed set of ~5M billable ad ids. There exact per-key state is affordable, and the counts are billed, so approximation is not on the table.",
        },
      },
    },
    {
      id: "ingest",
      label: "Ingest + normalise",
      kind: "service",
      sub: "lowercase, strip confusables",
      col: 0,
      row: 0,
      detail: {
        what: "The stateless tier that turns a raw post into a countable key and appends it to the stream.",
        why: "Whatever this step produces is the key space, so it defines what everything downstream is sized against. It lowercases, strips punctuation, collapses unicode look-alikes and stamps a geo. It has to run before partitioning, because the partition key must be the normalised key. Otherwise one term's counts scatter across all 64 shards and no shard's estimate is complete.",
        numbers: [
          {
            value: "~1M events/s peak, ~29B events/day",
            explain: "Peak write rate into the stream; the daily total is what the archive and the 24h retention are sized from.",
          },
          {
            value: "~72B per event, ~2.1TB/day raw",
            explain: "{key, user_id, ts, geo} ≈ 72B; 29B events × 72B ≈ 2.1TB a day before replication.",
          },
        ],
        breaks: {
          failure:
            "A normalisation regression that splits one term into variants, #Eclipse against #eclipse, halves both counts and drops the term off the list with no error raised anywhere.",
          handled:
            "New normaliser versions shadow-run for an hour beside the old one, and the cutover gate is top-50 overlap between the two: below 90% overlap the rollout is rolled back. A split that slips through is caught only by a human noticing, which is the residual risk.",
        },
        choice: {
          pick: "Normalise at ingest, ahead of partitioning, with new versions shadow-run for an hour",
          instead: "Normalising inside the sketch worker, after the event has already been partitioned.",
          decider:
            "Where the partition key comes from. Partitioning on the raw string spreads one logical key over 64 shards, so no shard sees enough of it to nominate it. The heap goes blind in exactly the mid-range where the rank-50 cutoff sits. The cutover gate is top-50 overlap between old and new normalisers: roll back below 90%.",
          flips: "A registered key vocabulary, where the key arrives as an id rather than a string and there is nothing to normalise.",
        },
      },
    },
    {
      id: "stream",
      label: "Event stream",
      kind: "queue",
      sub: "Kafka, hash(key), 24h",
      col: 1,
      row: 0,
      detail: {
        what: "A durable, replayable log carrying {key, user_id, ts, geo}, partitioned so that every occurrence of one key lands on one shard.",
        why: "Key-hash partitioning is not there for the counts. Counts merge correctly under any partitioning, because a cell address depends on the key and not on which worker incremented it. It is there for candidate discovery: a shard can only nominate a key it has seen enough of to believe is heavy.",
        numbers: [
          { value: "1M events/s peak", explain: "Spread over 64 partitions, ~15.6k events/s each; one partition is the unit of parallelism." },
          {
            value: "~2.1TB/day raw, RF=3 → ~6.3TB/day",
            explain: "29B events × 72B ≈ 2.1TB; three replicas for durability triples the disk to ~6.3TB per day retained.",
          },
          {
            value: "24h retention covers the longest window",
            explain: "The longest served window is 24h, so the stream can replay any minute still inside a window. Anything older lives only in the Raw archive.",
          },
        ],
        breaks: {
          failure: "A viral key at 200k events/s pins one partition and saturates a single worker while the other 63 idle.",
          handled:
            "A skew monitor watches hottest-shard rate over median. Above 2× it switches just that key to round-robin partitioning. The counts still merge correctly, and a key that hot is nominated by every shard even at 1/64th of its volume, so discovery survives.",
        },
        choice: {
          pick: "Kafka partitioned by hash(key), 24h retention",
          instead: "Round-robin partitioning, which spreads the hot key perfectly evenly.",
          decider:
            "What happens to nomination. Under round robin each of the 64 shards sees 1/64th of a key's traffic, so local estimates are 1/64th of the truth and heap nomination collapses in the mid-range. The counts are unaffected either way because the cell-wise merge reassembles them.",
          flips:
            "Hybrid, per key: when the skew monitor sees hottest-shard rate over median above 2×, round-robin just that key. Anything hot enough to trigger that is still enormous at 1/64th of its volume, so it is nominated regardless.",
        },
      },
    },
    {
      id: "archive",
      label: "Raw archive",
      kind: "database",
      sub: "Parquet, replay + audit",
      col: 2,
      row: 0,
      detail: {
        what: "Every raw event and every published list, written as Parquet partitioned by day.",
        why: "It is the only ground truth anywhere in the system. A key that appeared four minutes ago has no reconciliation target except the stream itself. Replay after a lost minute, review of a suppression decision, and any exact recount all start here.",
        numbers: [
          { value: "~2.1TB/day raw", explain: "The same 29B × 72B as the stream, kept for as long as audit needs it rather than 24h." },
          {
            value: "recount affordable only over the ~500 published candidates",
            explain: "An exact pass over 2.1TB per key is not something you do per query; scanning once for the ~500 candidates that were actually ranked is.",
          },
        ],
        breaks: {
          failure:
            "The recount it enables does not close the gap. It lands minutes after the list it describes, over a slightly different event set once late arrivals have landed. So it disagrees with the published estimate often enough to notice.",
          handled:
            "The design does not reconcile the two numbers; it labels them. A recount is served as an audit figure with its own as_of, never as a correction to the live list. Closing the gap would need exact per-key counting on the live path, which is the ~216GB map the whole design avoids.",
        },
        choice: {
          pick: "Parquet on object storage for both raw events and published lists",
          instead: "Relying on the stream's own 24h retention as the entire recovery and audit story.",
          decider:
            "The longest window is 24h, so the stream sits exactly at the edge with no margin. A suppression appeal or a newsroom query arrives days after the events behind it have aged out. Audit rows are also tiny next to raw events, so retaining lists forever is nearly free.",
          flips:
            "Deployments with no appeal or review obligation and no exact-count requests, where 24h of stream retention covers replay and nothing else needs keeping.",
        },
      },
    },
    {
      id: "sketch-worker",
      kind: "service",
      sub: "Count-Min d=7 w=32,768",
      label: "Sketch workers (x64)",
      col: 1,
      row: 1,
      parent: "counting-tier",
      detail: {
        what: "One worker per partition, holding a de-dup filter and a count-min sketch, counting every event it receives.",
        why: "Two things have to happen per event, in this order. First the dedup gate: test-and-set (user_id, key) in a Bloom filter that rotates every 5 minutes, so one user counts once per key. That makes volume mean distinct participants, the cheapest bot resistance there is. Then the sketch: hash the key once per row, add 1 to those 7 cells, and read the minimum back as the running estimate. The dimensions are derived, not chosen: w sets the size of the error at e ÷ w, d sets the probability the bound holds at e^-d. Taking the minimum rather than the mean keeps the error one-sided. Every row is contaminated upward, and the minimum is the least-collided sample rather than an average of the noise.",
        numbers: [
          {
            value: "7 writes, ~50ns per event",
            explain: "One hash and one increment per row; 7 rows. At ~15.6k events/s per shard that is ~110k counter writes/s, trivial for one core.",
          },
          {
            value: "ε = 8.3e-5, δ = 0.001, so ε × N ≈ 4,980 on a 60M-event minute",
            explain:
              "ε = e ÷ w = 2.718 ÷ 32,768; δ = e^-7. Any estimate is within ε × N of the truth with probability 1 − δ, and never below it.",
          },
          {
            value: "dedup: 300M pairs per generation, 1% false positives, ~11MB per shard",
            explain:
              "A 5-minute generation at ~15.6k events/s per shard × 64 shards ≈ 300M (user, key) pairs; a Bloom filter at 1% false positives costs ~9.6 bits per pair. Two generations rotate so the boundary does not reset everyone at once.",
          },
        ],
        breaks: {
          failure:
            "Over-promotion near the cutoff. Relative error at rank 50 is ~6.1% on a minute window and ~7.9% on a day, enough to reshuffle ranks 45 to 55 between refreshes. The dedup gate also deletes real events: at 1% false positives roughly 1% of genuine pairs never reach a counter.",
          handled:
            "The cache write applies hysteresis: a key must beat the rank-50 score by 10% to enter and fall 10% below to leave, so the ~6% noise cannot flicker the boundary. The 1% dedup loss is accepted and is uniform across keys, so ranks are unaffected; only the absolute counts carry it, and they are published as estimates anyway.",
        },
        choice: {
          pick: "Count-Min sketch, plain increments, d = 7 and w = 32,768",
          instead: "Space-Saving over a Stream-Summary, or Count-Min with conservative update.",
          decider:
            "How many times a partial result is combined before publication. One 1-hour list is 64 shards across 60 tiles, so 3,840 combining operations. Count-Min adds exactly, so all 3,840 are lossless. Space-Saving merges are heuristic and compound with no error signal, and conservative update makes cells path-dependent so they stop summing at all. Accuracy is a wash: 6,000 against 4,980 at equal memory.",
          flips:
            "A single aggregator with no cross-shard merge, roughly anything under 100k events/s. There Space-Saving carries the key strings and a per-key error bound for free, and the heap becomes dead weight.",
        },
      },
    },
    {
      id: "heap",
      label: "Per-shard top-500 heap",
      sub: "the only place key strings live",
      kind: "database",
      col: 2,
      row: 1,
      parent: "counting-tier",
      detail: {
        what: "A bounded min-heap of (key, current estimate) per shard, capped at 10× K, offered every key the worker processes.",
        why: "The grid threw the strings away and a hash does not reverse, so something has to supply candidates for the sketch to rank. Capping at 10× K rather than K puts the local cutoff far below the global one. That is what stops a globally heavy key being cut on a shard that happens to own several heavier ones.",
        numbers: [
          { value: "500 entries per (geo, window), ~26KB", explain: "10 × K with K = 50; each entry is a key string plus a 4-byte estimate, ~52B." },
          {
            value: "union of 64 heaps ≈ 32,000 candidates",
            explain: "64 shards × 500 entries, minus overlap. Every one of them is re-estimated against the merged grid, so the heaps' own numbers are never used for ranking.",
          },
        ],
        breaks: {
          failure:
            "It owns discovery, not counting. A key that no worker ever believed was heavy can never be ranked, whatever the merged sketch would have said about it.",
          handled:
            "The 10× slack means this needs a key outside the top 500 on every one of 64 shards while being globally top 50. The heavy-tailed shape of real traffic makes that implausible, not impossible. The only complete fix is a periodic exact pass over the Raw archive, which lands minutes late and is used for audit, not for the live list.",
        },
        choice: {
          pick: "Heaps merged as a candidate set only, then every candidate re-estimated against the merged sketch",
          instead: "Merging the 64 shards' local top-50 lists straight into a global top 50.",
          decider:
            "A key ranked 51st on every one of 64 shards can be globally first, and merging lists loses it silently. The candidate set is allowed to be lossy because a key outside the top 500 on every shard cannot plausibly be globally top-50 under a Zipf distribution. The counts used to rank it are not allowed to be lossy, which is why re-estimation is mandatory.",
          flips: "A single-shard deployment, where the local list is the global list and both the 10× slack and the re-estimation pass are pure overhead.",
        },
      },
    },
    {
      id: "abuse",
      label: "Abuse scorer",
      kind: "service",
      sub: "ASN, account age, graph",
      col: 0,
      row: 3,
      detail: {
        what: "An async consumer scoring concentration signals per candidate key and emitting soft demotion flags rather than deletions.",
        why: "Anything publicly ranked is a target, and per-(user, key) de-duplication has already priced out the single scripted account. What is left is many accounts acting together. Only concentration signals across network, account age and follow graph can see that at all. Every action here demotes and queues a key rather than deleting it, because deletion has no undo. Every decision is written to the audit trail so a fast override has something to act on. The override rate, not a raw flag count, says whether the scorer is calibrated.",
        numbers: [
          { value: "1 audit row per decision", explain: "Every demotion writes what fired and why, so a reviewer can override it and the override becomes training data." },
          {
            value: "target override rate under 5%",
            explain: "If reviewers reverse more than 1 in 20 demotions the scorer is over-firing; the rate is the calibration signal because there is no ground truth.",
          },
          { value: "review-queue backlog alarm above 500", explain: "Past ~500 queued keys a demotion waits longer than the story it is about, so the queue pages." },
        ],
        breaks: {
          failure:
            "It cannot separate 10,000 organised aged accounts from a genuine grassroots event. Both produce regional concentration, dense follow clustering and a burst of accounts created because of the event. Every threshold that catches one catches the other.",
          handled:
            "The design does not try to decide; it makes the wrong decision cheap. Demotion is a multiplier, never a deletion, so the key is still in the candidate set when a human overrides it within minutes. Telling the two apart would need content or off-platform signals this pipeline does not carry.",
        },
        choice: {
          pick: "Soft suppression with a human review queue and a fast override path",
          instead: "Hard removal above a score threshold.",
          decider:
            "The asymmetry of the two errors. A missed manipulation leaves an artifact you can study; a wrong demote silently kills a breaking story and produces none. So the only measurable signal is a queue with an override rate, targeted under 5%. There is no content or off-platform signal in this pipeline to separate the two cases.",
          flips:
            "Closed corpora with a registered publisher set, where a hard block is auditable against a known identity and grassroots events do not exist by construction.",
        },
      },
    },
    {
      id: "merger",
      label: "Merger",
      kind: "service",
      sub: "cell-sum, re-estimate",
      col: 2,
      row: 2,
      detail: {
        what: "The once-a-minute process that sums the 64 shard tiles into one grid and turns the shards' candidates into a globally ranked 500.",
        why: "Linear mergeability is the property the whole topology rests on, and this is where it is spent. sketch(A) + sketch(B) = sketch(A ∪ B) exactly, cell by cell. The merge itself introduces no approximation. It adds the tiles, pushes the result into the ring, unions the 64 heaps, and re-estimates every candidate against the merged window sketch. Sliding windows, shard-then-merge and cross-region aggregation are all consequences of that one property.",
        numbers: [
          {
            value: "64 × 229,376 = ~14.7M integer adds, ~20ms",
            explain: "229,376 cells per tile (7 × 32,768), 64 tiles, one addition per cell; a single core does it in ~20ms.",
          },
          {
            value: "59MB burst per minute, ~1MB/s of merge traffic",
            explain: "64 × 917KB arrives at the minute boundary. Averaged over the minute it is ~1MB/s, small enough that fan-in is not a bottleneck.",
          },
          {
            value: "32,000 × 7 = 224k re-probes, ~2ms",
            explain: "Each candidate is read from the merged grid: 7 cells, take the minimum. Then sort and keep 500. This is what makes the lossy candidate set safe to rank.",
          },
        ],
        breaks: {
          failure:
            "Summing tiles built with different (d, w) or hash seeds after a rolling deploy. They add arithmetically and produce a plausible, entirely meaningless result whose only symptom is rankings that quietly stop making sense.",
          handled:
            "Every tile carries a version header with its dimensions and seed, and the Merger refuses to add tiles whose headers differ. A deploy that changes the shape therefore runs both shapes side by side for one full window before the old one is retired.",
        },
        choice: {
          pick: "One designated merger per geo, all shards sealing on the same minute boundary",
          instead: "A hierarchical merge tree, or staggered seals merged incrementally as tiles arrive.",
          decider:
            "The work is not the bottleneck: 14.7M adds is ~20ms and the fan-in is ~1MB/s. 500ms of the 550ms publish budget is sealing and shipping, so a cleverer merge topology buys almost nothing against a 10s staleness SLO.",
          flips:
            "When the 550ms has to shrink or the fan-in grows past one process. Then staggered seals and incremental merging are the answer, at the cost of a window boundary fuzzy by a few hundred milliseconds.",
        },
      },
    },
    {
      id: "ring",
      label: "Sketch ring",
      kind: "database",
      sub: "minute + hour tiles/geo",
      col: 3,
      row: 2,
      detail: {
        what: "The per-geo window state: a ring of the last 60 minute tiles and 24 hour tiles, plus the running window sketch built from them.",
        why: "Three named windows come out of one structure because sketches subtract as exactly as they add. To slide, add the newest tile to the running window and subtract the tile that fell off the tail. You are only ever removing increments you previously added, so no cell can go negative and no expiry pass has to reason about which key contributed what.",
        numbers: [
          {
            value: "84 tiles × ~1.8MB ≈ 150MB per geo, ~30GB fleet",
            explain: "60 minute tiles + 24 hour tiles. Merged tiles use 8-byte counters (229,376 × 8B ≈ 1.8MB) because 64 summed shards overflow 4 bytes. 200 geos × 150MB ≈ 30GB.",
          },
          { value: "7.5% of a stated 2GB per-aggregator budget", explain: "150MB ÷ 2GB. Memory is not scarce here, which is why the ring beats a decayed sketch." },
          {
            value: "~150MB of ring against ~216GB of exact map",
            explain: "Same 24h coverage per geo; the map needs 1,440 × 150MB, the ring needs 84 × 1.8MB. About 1,400× smaller.",
          },
        ],
        breaks: {
          failure:
            "Dimension explosion. 200 geos is comfortable, but adding language and platform multiplies combinatorially, and 30GB becomes 3TB.",
          handled:
            "Only combinations the product actually serves are materialised, and the geo fallback chain means a sparse combination reads its parent's list instead of owning a ring. If every combination had to be first-class, the ring would give way to one exponentially decayed sketch per combination at ~1.8MB each, losing crisp window boundaries.",
        },
        choice: {
          pick: "A ring of per-minute and per-hour tiles",
          instead: "One exponentially decayed sketch per geo, every cell multiplied by 0.98 each minute for a ~34-minute half-life.",
          decider:
            "150MB against 1.8MB is 83×, but it is measured against a 2GB per-aggregator budget the ring uses 7.5% of. Memory is not scarce enough to buy a structure that cannot answer 'exactly the last 5 minutes'. The product ships three named windows and a rank_delta between refreshes, and both need crisp boundaries.",
          flips:
            "When the dimension you multiply by is large: 50,000 tenants, or one sketch per (geo, language, platform). There 1.8MB against 150MB decides it immediately, and there is no boundary artefact either.",
        },
      },
    },
    {
      id: "scorer",
      label: "Trend scorer",
      kind: "service",
      sub: "z vs baseline, floor, damper",
      col: 2,
      row: 3,
      detail: {
        what: "The once-a-minute ranker that scores the surviving 500 candidates against their own history and writes the top 50.",
        why: "Trending means rate of change, not volume. Rank by raw count and the same famous terms win every day, because a term that is always enormous is background rather than news. That is the entire difference between this and a leaderboard. The score is z = (r_short − μ) ÷ max(σ, σ_floor): how many usual spreads above its usual rate a key is running. Three guards handle keys with no history: an absolute floor, a prior, and an age damper. The Abuse scorer's multiplier is applied here, last, so it can be overridden without touching counts.",
        numbers: [
          {
            value: "μ = 10,000/min, σ = 1,500, reading 10,500 → z = 0.33, ignored",
            explain: "(10,500 − 10,000) ÷ 1,500 = 0.33. A third of a usual spread above normal is a Tuesday, however large the raw count.",
          },
          {
            value: "μ = 10/min, σ = 4, reading 500/min → z = 122",
            explain: "(500 − 10) ÷ 4 = 122.5. A small term running 50× its normal is the story, and the score says so without any absolute threshold.",
          },
          {
            value: "floor ≥ 500 counts in 5 min; prior μ0 = 1/min, σ0 = 2; damper min(1, age_min ÷ 15)",
            explain:
              "A new key has no μ or σ. The prior supplies one so z is finite. The floor stops 200 counts qualifying at all. The damper scales the score up over the key's first 15 minutes, so it cannot jump straight to the top on its first refresh.",
          },
        ],
        breaks: {
          failure:
            "Cold start. A key born inside the window has no history at all. Without guards, anything brand new takes the top slot on a few hundred counts and holds it for one refresh.",
          handled:
            "The floor, the prior and the age damper together. 500 counts in 5 minutes to qualify at all, a prior of 1/min so the score is finite, and a weight that ramps over 15 minutes. A genuinely explosive new key still reaches the top; it takes a few refreshes to get there instead of one.",
        },
        choice: {
          pick: "Per-key EWMA of rate and variance at a 7-day half-life, plus a minute-of-day profile for the top keys",
          instead: "Pure sketch arithmetic: (count_5m ÷ 5) divided by (count_24h ÷ 1440), with no baseline store at all.",
          decider:
            "What the ratio does to a key born inside the window. Its 24-hour count equals its 5-minute count, so the ratio is exactly 1440 ÷ 5 = 288 for every new key regardless of size. A 500-count key ties a 500,000-count key at the top and the expression has nowhere to put a prior. The baseline form has an explicit slot for one, at ~290MB.",
          flips:
            "When the baselines would be mostly empty anyway, inside a live event or a market launched last week. There you pay 290MB and a join to read back a constant. The ratio is the outage fallback regardless, so it is code you write either way.",
        },
      },
    },
    {
      id: "baselines",
      label: "Baseline store",
      sub: "Redis/KV, EWMA rate + variance",
      kind: "database",
      col: 3,
      row: 3,
      detail: {
        what: "Per key, an EWMA of its rate, an EWMA of its variance, and a 1,440-slot minute-of-day profile for the top keys.",
        why: "This is the only thing in the system that converts 'high' into 'unusually high'. Without it the ranking has no notion of normal. No amount of counting accuracy tells you whether 10,500 a minute is a story or a Tuesday. The minute-of-day profile exists because normal is not flat: 'coffee' is normal at 8am and strange at 3am.",
        numbers: [
          { value: "7-day half-life", explain: "An EWMA forgets on a half-life; 7 days means last week's spike still counts for half as much as today's, so one event does not become the new normal." },
          {
            value: "~100k profiled keys × ~2.9KB ≈ 290MB",
            explain: "Two floats per key for everyone, plus a 1,440-slot profile (1,440 × 2B) only for the ~100k keys that have ever ranked. Small enough to live in one Redis.",
          },
          { value: "500 gets per cycle, ~5ms pipelined", explain: "Only the truncated 500 are joined; 500 pipelined reads is ~5ms of the ~550ms cycle." },
        ],
        breaks: {
          failure:
            "Join amplification. Joining all ~32k candidates every minute per geo would be ~100k gets/s fleet-wide. So the join happens after truncation, and a key rising from deep in the tail waits one extra cycle for its baseline.",
          handled:
            "Baselines of recently trending keys are cached in the scorer, so a returning key is scored immediately. A truly new key pays the one-cycle delay, ~60s, which the age damper hides anyway. If the store is unreachable the scorer falls back to the short-over-long rate ratio and marks the list degraded_scoring.",
        },
        choice: {
          pick: "Join after truncating to the top 500, with recently trending baselines cached",
          instead: "Joining all ~32k candidates before the sort so every candidate is scored properly.",
          decider:
            "32k gets per minute per geo is ~100k/s fleet-wide, against 500 gets at ~5ms pipelined. A ~64× reduction for one cycle of extra latency on keys that were nowhere near the cutoff anyway.",
          flips: "Few geos and a small candidate union, where the fleet-wide rate is trivial and scoring every candidate gives a genuinely better cutoff.",
        },
      },
    },
    {
      id: "cache",
      label: "Top-K cache",
      sub: "Redis, trending:{geo}:{window}",
      kind: "database",
      col: 2,
      row: 4,
      detail: {
        what: "The materialised answer: 50 entries plus an as_of timestamp per (geo, window), rewritten every 5 seconds.",
        why: "The expensive work has to happen once a minute for everyone rather than once per request. If the trending panel computed anything at all it would immediately be the most expensive query in the product, and it is on the first screen of every session. The geo fallback chain is resolved at write time too, so a sparse metro never returns an empty panel.",
        numbers: [
          { value: "3 windows × ~200 geos × ~5KB ≈ 3MB total", explain: "600 lists of 50 entries at ~100B each. The entire product answer fits in one Redis with room to spare." },
          { value: "600 writes per 5s = 120 writes/s", explain: "Every list is rewritten each 5s tick whether or not it changed; 120/s is nothing for Redis." },
          { value: "list at most ~10s stale", explain: "~550ms of pipeline plus up to one 5s write tick plus the client's own refresh; well inside what a trending panel needs." },
        ],
        breaks: {
          failure: "Eviction or a failover leaves the key empty and the panel blank.",
          handled:
            "The Trending API keeps a last-known-good copy of every list in process and serves it with its as_of, so a Redis failover shows a slightly stale list rather than nothing. The next 5s tick repopulates the key.",
        },
        choice: {
          pick: "Precomputed lists in Redis, rewritten on a 5s timer, with the geo fallback chain resolved at write time",
          instead: "Computing the top-K per request from the sketch ring.",
          decider:
            "~17k reads/s average and ~60k/s peak against 120 writes/s, a ratio of roughly 140 to 1. Per-request scoring would be 224k sketch probes plus a 500-key baseline join per read. The materialised form is a single GET at ~2ms p99 against a 20ms SLO.",
          flips: "Per-tenant trending with a tiny audience, where the timer burns a cycle a minute on lists nobody opens and computing on demand is cheaper.",
        },
      },
    },
    {
      id: "api",
      label: "Trending API",
      kind: "service",
      sub: "GET /trending?window=&geo=",
      col: 3,
      row: 4,
      detail: {
        what: "The read tier: one GET against the cache key, plus a per-key drill-down that returns count_est alongside its error_bound.",
        why: "The read path deliberately touches no sketch, so sizing it is a cache problem rather than a streaming problem. The geo fallback chain is resolved at write time, so a sparse metro never returns an empty panel and the API stays a lookup.",
        numbers: [
          { value: "~1.5B panel loads/day, ~17k/s avg and ~60k/s peak", explain: "1.5B ÷ 86,400 ≈ 17k/s; peaks run ~3.5× average during a live event." },
          { value: "p99 < 20ms SLO, ~2ms served", explain: "One Redis GET plus serialisation; the 10× headroom is what lets the API survive a failover on its in-process copy." },
        ],
        breaks: {
          failure: "It cannot answer 'exactly how many'. The sketch returns an upper bound, so there is never a figure anyone can reconcile against anything.",
          handled:
            "The API publishes count_est with an error_bound and never a bare count, and the drill-down says so in its schema. A caller who needs an exact figure for one key gets a recount from the Raw archive, minutes later, labelled as an audit number.",
        },
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
      tier: "hot",
      step: 1,
      label: "normalised key, geo",
      detail: {
        what: "Normalised events appended to the log as {key, user_id, ts, geo}, keyed for partitioning on the normalised string.",
        why: "Normalisation has to precede the append because the partition assignment is computed from the key here. Get the order wrong and one logical term is split across shards before anything has a chance to count it.",
        numbers: [
          { value: "~72B per event", explain: "A short key, a user id, a timestamp and a geo code; the archive and stream sizes follow from this." },
          { value: "~29B events/day", explain: "1M/s at peak, averaging ~340k/s over the day." },
        ],
        breaks: {
          failure:
            "Any normalisation change alters the partition assignment for existing keys mid-flight, so a term's counts land on two shards during the rollout and neither is complete.",
          handled:
            "New normaliser versions shadow-run for an hour, and cutover happens at a minute boundary for all producers at once, so at most one minute tile is split. The Merger's cell-wise sum reassembles the counts; only nomination for that minute is degraded.",
        },
      },
    },
    {
      id: "e2",
      from: "stream",
      to: "sketch-worker",
      tier: "hot",
      step: 2,
      label: "partition by hash(key)",
      detail: {
        what: "The hot path: each worker consuming the partitions it owns, ~15.6k events/s per shard.",
        why: "One key on one shard is what makes a local estimate complete, which is what makes a heap nomination mean anything. The counts would merge correctly under any partitioning; the nominations would not.",
        numbers: [
          { value: "1M events/s across 64 shards", explain: "The peak the fleet is sized for; each shard is one consumer on one core." },
          { value: "~15.6k events/s per shard", explain: "1M ÷ 64. At ~50ns of sketch work per event that is under 1ms of CPU per second." },
        ],
        breaks: {
          failure: "A viral key at 200k events/s saturates one consumer while 63 idle, and adding machines does not help because the partition is the unit of parallelism.",
          handled:
            "The skew monitor switches that one key to round-robin above 2× median shard rate, spreading it over all 64 consumers. Its counts still merge exactly, and at 1/64th of 200k/s it is still the biggest thing on every shard, so it is nominated everywhere.",
        },
      },
    },
    {
      id: "e3",
      from: "stream",
      to: "archive",
      tier: "control",
      label: "raw events, replay + audit",
      detail: {
        what: "A parallel consumer landing every raw event as Parquet, partitioned by day and hour.",
        why: "It is the only durable record beyond the 24h retention, and the 24h window is exactly the longest one served, so there is no margin. Replaying a lost minute into a catch-up worker also happens from here.",
        numbers: [
          { value: "~2.1TB/day raw", explain: "Same bytes as the stream, written once, kept for audit." },
          { value: "24h stream retention against a 24h window", explain: "Zero margin: a replay of the oldest minute in the day window has to come from here, not from Kafka." },
        ],
        breaks: {
          failure:
            "Nothing on the serving path waits for this consumer. If the archive falls behind, every published list still looks perfect and the loss shows up only when someone asks for a recount.",
          handled:
            "Archive lag is monitored as its own SLO, alarmed past 10 minutes, and the archive consumer can replay from the stream's 24h retention when it catches up. A gap longer than 24h is permanent, which is the accepted cost of keeping the archive off the hot path.",
        },
      },
    },
    {
      id: "e4",
      from: "stream",
      to: "abuse",
      tier: "control",
      label: "user, ASN, graph signals",
      offset: 100,
      detail: {
        what: "An independent consumer reading the same events for concentration signals: network origin, account age, follow-graph density.",
        why: "Abuse scoring is deliberately off the counting path, because it is slower and less certain than counting and must never be able to stall a publish cycle. It flags asynchronously and the scorer applies whatever has arrived.",
        numbers: [{ value: "0ms added to the publish cycle", explain: "The scorer reads flags that already exist; it never waits for this consumer." }],
        breaks: {
          failure: "Its verdicts arrive on their own schedule, so a manipulation detected after a list has published stays visible until the next refresh.",
          handled:
            "Refreshes are every 5s and flags apply from the next one, so the exposure is seconds, not minutes. Making the flag synchronous would put the slowest, least certain component on the publish path, which the design refuses.",
        },
      },
    },
    {
      id: "e6",
      from: "sketch-worker",
      to: "heap",
      tier: "hot",
      step: 3,
      label: "offer(key, est)",
      detail: {
        what: "After incrementing, the worker reads the same 7 cells, takes the minimum, and offers (key, estimate) to its bounded heap.",
        why: "This is the only place a key string is retained anywhere in the counting tier. The estimate offered alongside it is already the sketch's answer, so the heap is ordering by the same quantity the merger will later re-derive.",
        numbers: [
          { value: "capped at 500 = 10× K per shard", explain: "K = 50 published; 10× slack so the local cutoff sits far below the global one." },
          { value: "~26KB per (geo, window)", explain: "500 × ~52B; small enough to ship beside the tile every minute." },
        ],
        breaks: {
          failure: "The offer is made against a per-shard estimate, so a key spread thinly across shards is never offered anywhere and cannot be discovered.",
          handled:
            "Key-hash partitioning makes 'spread across shards' the exception, not the rule: a key normally lives on exactly one shard, so its local estimate is its global one. Only keys the skew monitor round-robins are spread, and those are huge by definition.",
        },
      },
    },
    {
      id: "e7",
      from: "sketch-worker",
      to: "merger",
      tier: "hot",
      step: 4,
      label: "sealed 917KB tile, 60s",
      detail: {
        what: "At the minute boundary the worker seals its grid, ships ~917KB, and starts a fresh one.",
        why: "Shipping counters rather than events is the compression that makes the whole topology affordable. 64 shards produce 59MB a minute instead of the tens of gigabytes of raw traffic behind it. The same trick carries a region's counts cross-region at ~8GB/day against ~2.1TB/day.",
        numbers: [
          { value: "~917KB per tile, 64 tiles = 59MB/min", explain: "7 × 32,768 × 4B per tile; the fan-in the Merger absorbs at each minute boundary." },
          { value: "~1MB/s of merge traffic", explain: "59MB ÷ 60s. Cross-region the same tiles are ~8GB/day per region." },
        ],
        breaks: {
          failure:
            "All 64 shards seal on the same instant, so the publish cycle blocks on the slowest, and a worker restart loses its in-flight minute entirely.",
          handled:
            "The Merger waits at most 2s for stragglers, then publishes with the tiles it has and marks the list partial. A lost minute is replayed from the stream into a catch-up worker and merged late, which the ring accepts because addition is order-independent.",
        },
      },
    },
    {
      id: "e8",
      from: "heap",
      to: "merger",
      tier: "data",
      label: "500 key strings/shard",
      detail: {
        what: "Each shard's 500 candidate strings shipped alongside its sealed tile and unioned into ~32,000 candidates.",
        why: "The merger needs strings it cannot get from the grid. This arrow carries only candidates, never rankings, because the ordering they arrive with is per-shard and about to be thrown away.",
        numbers: [
          { value: "~26KB per shard", explain: "500 strings with their estimates; negligible beside the 917KB tile." },
          { value: "union ≈ 32,000 candidates", explain: "64 × 500 minus overlap; every one is re-estimated before ranking." },
        ],
        breaks: {
          failure: "If this were the merged ranking rather than a candidate set, a key ranked 51st on every shard would vanish from the global list with nothing anywhere reporting an error.",
          handled: "It is not a ranking. The Merger discards the per-shard estimates on arrival and re-reads every candidate from the merged grid, so only global counts ever order the list.",
        },
      },
    },
    {
      id: "e9",
      from: "merger",
      to: "ring",
      tier: "data",
      label: "push tile, subtract tail",
      detail: {
        what: "The merged minute tile added into the running window sketch cell by cell, and the tile from 60 minutes ago subtracted out.",
        why: "This is what a sliding window costs when the structure is linear: two passes over 229,376 cells, no per-key bookkeeping, no decision about which key expired. It works only because addition is exact and subtraction removes increments you previously added.",
        numbers: [
          { value: "229,376 cells per tile", explain: "7 × 32,768. One add and one subtract per cell per minute, ~1ms." },
          { value: "60 minute tiles + 24 hour tiles per geo", explain: "Enough to build 5-minute, 1-hour and 24-hour windows by summation." },
        ],
        breaks: {
          failure: "It is unforgiving about shape. Adding a tile built with different dimensions or hash seeds corrupts the window silently, since mismatched sketches still sum arithmetically.",
          handled: "Every tile carries a version header and the Merger refuses to cross versions, so a mismatched tile is rejected and logged rather than added. A shape change runs both shapes for a full window before cutover.",
        },
      },
    },
    {
      id: "e10",
      from: "merger",
      to: "scorer",
      tier: "hot",
      step: 5,
      label: "~32k re-estimated",
      detail: {
        what: "Every candidate re-estimated against the merged window sketch, sorted, truncated to the top 500, and handed on for scoring.",
        why: "Re-estimation is the step that makes a lossy candidate set safe. The candidates may be missing keys no shard nominated, but the counts used to order them are now global rather than per-shard.",
        numbers: [
          { value: "32,000 × 7 = 224k probes, ~2ms", explain: "Seven cell reads per candidate, minimum taken; memory-bound and trivial." },
          { value: "truncated to 500 before any join", explain: "The baseline join is the expensive step, so only the 500 that could plausibly rank pay for it." },
        ],
        breaks: {
          failure: "Skipping this and sorting on the per-shard estimates that arrived with the heaps is exactly the bug the heap slack exists to survive.",
          handled: "The per-shard estimates are dropped at the Merger's boundary; the scorer's input type carries only merged-grid counts, so there is no code path that ranks on shard-local numbers.",
        },
      },
    },
    {
      id: "e11",
      from: "abuse",
      to: "scorer",
      tier: "control",
      label: "soft demote flags",
      detail: {
        what: "Suppression flags applied as a score multiplier at ranking time rather than as a filter at ingest.",
        why: "Demoting at the last possible moment keeps the counting tier free of policy and keeps every decision reversible. A wrongly suppressed key is still sitting in the candidate set when a human overrides it.",
        numbers: [
          { value: "multiplier ranges 0 to 1, never a deletion", explain: "0.5 halves a key's score; 0 hides it; the counts underneath are untouched and an override restores it instantly." },
          { value: "1 audit row per decision", explain: "What fired, on which key, with which signals; the review queue reads these." },
        ],
        breaks: {
          failure: "Flags arriving after a publish apply only from the next cycle, so a manipulated term is visible for up to one refresh. The same signals also fire on genuine grassroots events.",
          handled:
            "One refresh is 5s, so exposure is short. The grassroots false positive is handled by making demotion reversible in minutes through the review queue, not by trying to tell the cases apart, which this pipeline's signals cannot do.",
        },
      },
    },
    {
      id: "e12",
      from: "scorer",
      to: "baselines",
      tier: "data",
      label: "top 500 baseline join",
      detail: {
        what: "500 pipelined KV gets pulling each surviving candidate's EWMA rate, variance and minute-of-day profile.",
        why: "The join happens after truncation on purpose. Scoring all ~32k candidates would be ~100k gets/s fleet-wide for keys that were never going to make the cut.",
        numbers: [
          { value: "500 gets, ~5ms pipelined", explain: "One round trip carrying 500 keys; ~1% of the publish cycle." },
          { value: "~100k gets/s if joined before truncation", explain: "32k × 200 geos ÷ 60s. The truncation is a ~64× saving." },
        ],
        breaks: {
          failure: "If the store is unavailable there is no notion of normal and the ranking degrades to volume.",
          handled:
            "The scorer falls back to the short-over-long rate ratio, (count_5m ÷ 5) ÷ (count_24h ÷ 1440), which needs only sketch probes. The list is served with a degraded_scoring flag so clients can label it.",
        },
      },
    },
    {
      id: "e13",
      from: "scorer",
      to: "cache",
      tier: "hot",
      step: 6,
      label: "top 50 + as_of, every 5s",
      detail: {
        what: "The finished list written as a small JSON blob per (geo, window), with the geo fallback chain resolved so every key is populated.",
        why: "This is the boundary between the streaming system and the product. Everything upstream is per-minute batch work; everything downstream is a key-value lookup, and the two are sized completely independently.",
        numbers: [
          { value: "~5KB per list, ~3MB total", explain: "50 entries × ~100B, 600 lists." },
          { value: "120 writes/s across the fleet", explain: "600 lists every 5s." },
        ],
        breaks: {
          failure: "With ~6% counting error, keys near rank 50 would flicker in and out of the list between consecutive refreshes.",
          handled:
            "Hysteresis is applied at this write: a key must beat the rank-50 score by 10% to enter and fall 10% below it to leave. The boundary is therefore wider than the error, so a key crosses it because its score changed, not because the estimate wobbled.",
        },
      },
    },
    {
      id: "e14",
      from: "cache",
      to: "api",
      tier: "hot",
      step: 7,
      label: "single GET, ~2ms p99",
      detail: {
        what: "The entire read path: one key-value lookup returning a precomputed list plus its as_of timestamp.",
        why: "The panel is on the first screen of every session, so the read has to be the cheapest thing in the system. Anything computed per request would make trending the most expensive query in the product by an order of magnitude.",
        numbers: [
          { value: "~17k/s average, ~60k/s peak", explain: "1.5B loads/day ÷ 86,400 ≈ 17k/s; live events push it to ~3.5× that." },
          { value: "~2ms p99 against a 20ms SLO", explain: "One GET plus serialisation; the headroom absorbs a Redis failover served from the in-process copy." },
        ],
        breaks: {
          failure: "An empty key after eviction returns a blank panel.",
          handled: "The API holds a last-known-good copy of every list in process and serves it with its as_of, surfacing staleness instead of nothing, until the next 5s tick refills the key.",
        },
      },
    },
  ],
};
