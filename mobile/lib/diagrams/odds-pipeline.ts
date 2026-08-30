import type { Diagram } from "./types";

export const ODDS_PIPELINE: Diagram = {
  id: "odds-pipeline",
  title: "Odds Model Pipeline",
  question: "Design a Betting Odds Model Pipeline and Trader Platform",
  sourceId: "patterns",
  itemId: 57,
  overview: {
    shape:
      "Every CSV lands as an immutable versioned object, and the Catalog seals the latest versions into a snapshot that every model run is pinned to. The Trader gateway joins the newest run's odds with a live market feed in memory and pushes only what changed.",
    forces: [
      {
        constraint: "~2,500 CSV files a day from ~120 scrapers with no shared clock, some of them 400MB",
        decision: "Files are immutable versioned objects in the Raw CSV store, and the Catalog seals them into snapshots; a run never reads a file that is still being written",
        lights: ["blob", "catalog", "e2", "e3"],
      },
      {
        constraint: "Lineups land ~60 min before kick-off and a full model run takes ~25 min",
        decision: "The Orchestrator scopes a rerun to the fixtures whose inputs changed, about 2 min, and coalesces triggers for 30s so one lineup sheet is one run",
        lights: ["orchestrator", "e4", "e5"],
      },
      {
        constraint: "The model reads CSV from local disk, ~8GB a day, and reruns up to ~60 times on a Saturday",
        decision: "The Model runner keeps a content-addressed local cache and pulls only objects whose version changed: ~2MB for a lineup rerun, not 8GB",
        lights: ["runner", "e6"],
      },
      {
        constraint: "300k market prices, ~5,000 changes a second in play, and 20 traders who need them within 1s",
        decision: "The Market ingester publishes only changed prices to the Odds bus; the Trader gateway holds the whole book in memory and pushes deltas over a WebSocket",
        lights: ["ingester", "bus", "gateway", "e11", "e12", "e13"],
      },
      {
        constraint: "A model price is true of one snapshot at one as_of, and the market moves ~5,000 times a second in play",
        decision: "Every odd carries run_id and snapshot_id; the Trader gateway flags a fixture stale when the Catalog holds a newer snapshot than the run that priced it",
        lights: ["gateway", "odds-store", "catalog", "e9"],
      },
    ],
    naive: {
      text: "Scrapers write CSV into a shared network folder. A cron job runs the Python model at 06:00 on whatever is there. The model writes odds.csv, and traders open it in a spreadsheet next to a bookmaker's website. It breaks in two places. A 400MB results export takes ~40s to write at 10MB/s. A model that starts inside that window reads half the rows and prices every fixture wrong, with no error anywhere. And a lineup published 60 min before kick-off cannot wait for a 25-min full run that is already queued behind another one. The Raw CSV store and the Catalog turn files into sealed snapshots, and the Orchestrator turns a rerun into a 2-min job over only the fixtures that changed.",
      lights: ["blob", "catalog", "orchestrator"],
    },
    beats: [
      {
        text: "The Scrapers are ~120 small programs, one per Web sources site or vendor feed, that run on a schedule or on demand. Each produces one CSV per scrape and uploads it to the Raw CSV store, an object store with versioning on. An upload is atomic: the object does not exist until the last byte is written, so nothing downstream can ever read a half-written file. Every version keeps its own id and checksum. The key is source/date/time, and nothing is ever overwritten, so yesterday's lineups file is still there tomorrow.",
        lights: ["sources", "scrapers", "blob", "e1", "e2"],
      },
      {
        text: "The store raises an event for every new object, and the Catalog turns it into a row: source, key, version, row count, checksum, produced_at. A snapshot is the set of latest versions across every source at one moment, sealed under an id. A model run is pinned to a snapshot id, so the same run can be repeated a month later on exactly the same bytes. Each source carries a rerun policy: a lineups file says rerun now, a historical results export says wait for the daily run.",
        lights: ["catalog", "e3"],
      },
      {
        text: "The Orchestrator owns the calendar. It starts the full run at 06:00 over the whole snapshot, and it listens for rerun-tagged sources landing in the Catalog. A rerun is scoped: the Catalog says which fixtures the new file touches, and the job carries that list. Triggers are coalesced for 30s, so a lineup sheet that arrives as four files becomes one run. One run per model at a time, and a queued run is replaced by a newer one rather than running twice. A trader can also press rerun now.",
        lights: ["orchestrator", "e4", "e5", "e14"],
      },
      {
        text: "The Model runner is a Python worker with a local NVMe disk. It receives a job of run_id, snapshot_id and scope, and makes the snapshot real on disk. Its cache is content-addressed: files are stored by the hash of their bytes, so it pulls only objects whose version is not already local. A lineup rerun pulls ~2MB; the 06:00 run pulls ~8GB once. The model then reads plain local CSV, which is the only interface it ever asked for. It writes one row per market and selection with run_id attached, and announces run_published on the Odds bus.",
        lights: ["runner", "e6", "e7", "e8"],
      },
      {
        text: "The Odds store keeps every row of every run for ever: run_id, fixture, market, selection, prob, fair_odds, as_of, snapshot_id. Rows are never updated. The current odds for a fixture are the rows of the newest completed run that priced it. A daily run writes ~10,000 rows and a scoped rerun a few hundred, so a year is ~11GB. That is what lets a trader ask what the model said at 14:02 and get the real answer.",
        lights: ["odds-store", "e7", "e9"],
      },
      {
        text: "The Market ingester talks to the Bookmaker APIs and does the unglamorous work. It maps each bookmaker's team and market names onto our fixture and market ids, using a mapping table that a person maintains. It polls pre-match prices in a 30s sweep that stays inside the vendor's 20 requests a second, and takes in-play prices from the vendor's streaming feed. Around 80% of polled prices are unchanged, so it publishes only changes to the Odds bus, each with a sequence number.",
        lights: ["bookmakers", "ingester", "bus", "e10", "e11"],
      },
      {
        text: "The Trader gateway holds the whole book in memory: the newest model row per selection and the latest price per bookmaker, ~60MB. On every market delta it recomputes the edge for that selection: the model's probability minus the bookmaker's implied probability, 1 ÷ price. The overround, the margin that makes a book's prices sum past 100%, is removed first. A Trader UI connecting over a WebSocket gets the full state with a sequence number, then only deltas after it. When a run is published the gateway loads its rows from the Odds store and pushes the changed fixtures.",
        lights: ["gateway", "ui", "e12", "e13", "e9"],
      },
      {
        text: "Two budgets. A lineup rerun: scrape ≤ 60s on the lineup scraper's 1-min cadence, upload and Catalog ~1s, coalesce 30s, pull ~2MB under 1s. Then the scoped model ~2 min and write and publish ~1s: about 3.5 min against a 5-min target. A market change is vendor stream to Market ingester ~50ms, Odds bus ~5ms, gateway recompute and push ~50ms: about 100ms against a 1s target in play. Pre-match the 30s sweep is the floor, and the screen says so.",
        lights: ["orchestrator", "runner", "ingester", "gateway", "e5", "e6", "e11", "e13"],
      },
    ],
    crux: {
      problem:
        "The two feeds run on different clocks. A model price is a point in time: it was true of one snapshot at one as_of. A market price changes every second. A trader who takes a 4-point edge on a model that has not seen the new lineup is not finding value, they are giving it away.",
      handled:
        "Every model row carries snapshot_id, and the Trader gateway compares it with the Catalog's newest snapshot for that fixture. A newer snapshot means the model is stale, and the screen shows the fixture greyed with rerun pending until the run lands, ~3.5 min later. The edge is never shown without the model's age beside it. What remains: information the scrapers never captured, an injury posted on social media, moves the market with nothing to trigger a rerun. The design cannot know what it does not ingest.",
    },
    numbers: [
      {
        value: "~8GB, ~2,500 files a day",
        explain:
          "~120 sources, most scraped a few times a day, each scrape one CSV of 2–5MB; a handful of historical exports at ~400MB. This is the daily pull for the 06:00 run and the yearly growth of the store, ~3TB.",
      },
      {
        value: "~25 min full run vs ~2 min scoped rerun",
        explain:
          "The full run reads the whole day's ~8GB and prices ~400 fixtures × 25 markets on a 16-core box. A rerun scoped to the fixtures a lineup file touches, usually 1 to 10, does under 5% of that work.",
      },
      {
        value: "~3.5 min lineup-to-odds vs 5 min target",
        explain:
          "Scrape ≤ 60s + upload and Catalog ~1s + coalesce 30s + pull under 1s + model ~2 min + write and publish ~1s. Lineups land ~60 min before kick-off, so traders get ~55 min of priced market.",
      },
      {
        value: "300k prices, ~5,000 changes/s in play",
        explain:
          "400 fixtures × 25 markets × ~3 selections = 30k selections, × 10 bookmakers = 300k prices. In play a fixture's prices move on every event; the 30s pre-match sweep adds ~2,000 changes/s after dedup. The bus carries ≤ ~7,000 messages/s at ~150B, about 1MB/s.",
      },
      {
        value: "~60MB of gateway state",
        explain:
          "300k prices × ~200B including the last few values, plus ~10,000 model rows. It fits in one process with a warm standby, which is why the gateway is not a cluster.",
      },
    ],
  },
  nodes: [
    {
      id: "sources",
      label: "Web sources + vendor APIs",
      kind: "external",
      sub: "~120 sites and feeds",
      col: 0,
      row: 0,
      detail: {
        what: "The websites and third-party feeds the scrapers read: fixtures, lineups, results, weather, injuries.",
        why: "None of them is ours, so each can change layout, go down, or rate-limit us without notice. The design treats every source as unreliable and every file from it as a fact about one moment, not a live view.",
        numbers: [
          { value: "~120 sources", explain: "Roughly one scraper per source; the count sets how many independent schedules the Orchestrator has to tolerate." },
          { value: "lineups ~60 min before kick-off", explain: "The event that matters most and arrives latest; the rerun target of 5 min is set from it." },
        ],
        breaks: {
          failure: "A site changes its HTML and the scraper writes a CSV with the right columns and zero rows, or rows in the wrong units.",
          handled:
            "The Catalog records the row count and a per-source schema check on every object. A file whose row count is under 20% of the source's 7-day median, or whose columns differ, is quarantined. The run uses the previous version, with a data_stale flag on the affected fixtures.",
        },
      },
    },
    {
      id: "scrapers",
      label: "Scrapers",
      kind: "service",
      sub: "one per source, cron + on demand",
      col: 1,
      row: 0,
      detail: {
        what: "Small programs, one per source, that fetch pages or API responses and write one CSV per scrape.",
        why: "They already exist, and the design leaves them alone except for one rule: write the CSV to the object store as one atomic upload, keyed by source, date and time. Everything downstream depends on a file existing only once it is complete.",
        numbers: [
          { value: "~2,500 CSV files a day", explain: "~120 sources at a few scrapes a day each, plus the lineup scrapers at 1-min cadence in the hour before kick-off." },
          { value: "2–5MB typical, ~400MB largest", explain: "A lineup file is a few KB; a historical results export is hundreds of MB. Both go through the same path because the upload is atomic either way." },
        ],
        breaks: {
          failure: "A scraper crashes half way and retries, so the same scrape lands twice, or a scheduled and a manual scrape of the same source overlap.",
          handled:
            "Every upload is idempotent: the key includes the scrape's scheduled time and the store's versioning keeps both attempts. The Catalog dedups on checksum, so two identical uploads are one snapshot entry and trigger one rerun, not two.",
        },
        choice: {
          pick: "Keep the existing scrapers, add one atomic upload step to a versioned object store",
          instead: "Rewrite the scrapers as workers on a shared framework that streams rows into a database.",
          decider:
            "~120 programs written by different people over years. One upload step is a 10-line change per scraper; a framework is a rewrite of all 120 before any value lands. The model wants CSV anyway, so a row store would be converted straight back.",
          flips:
            "When the scrapers are rewritten for another reason, or when a source needs sub-second updates, which a CSV every minute cannot carry.",
        },
      },
    },
    {
      id: "blob",
      label: "Raw CSV store",
      kind: "blob",
      sub: "S3, versioned, source/date/time",
      col: 2,
      row: 0,
      detail: {
        what: "Object storage with versioning on, holding every CSV any scraper ever wrote.",
        why: "Two properties do the work. An object is atomic: it exists only once the last byte is written, so a reader never sees a partial file. And a version is immutable: a new scrape of the same source is a new version, never an overwrite. A run pinned to a version reads the same bytes for ever.",
        numbers: [
          { value: "~8GB a day, ~3TB a year", explain: "2,500 files at the typical 2–5MB plus a few 400MB exports. Kept for ever because backtests need history; ~3TB of object storage is under $70 a month." },
          { value: "~200MB/s pull to a worker in the same region", explain: "The full 8GB snapshot lands on a Model runner's disk in ~40s. A lineup rerun pulls ~2MB in well under 1s." },
        ],
        breaks: {
          failure: "A scraper with a bug writes the right file to the wrong key, so the Catalog files today's lineups under yesterday's date and the run reads stale ones.",
          handled:
            "The Catalog trusts produced_at inside the file header over the key, and the snapshot is built from produced_at. A mismatch between key and header is logged and the newer produced_at wins. The key is a convenience for humans, not the source of truth.",
        },
        choice: {
          pick: "A versioned object store; S3 is the reference",
          instead: "A shared network file system mounted on the scrapers and the model box, which is what the folder-and-cron design uses.",
          decider:
            "Partial reads. A 400MB export takes ~40s to write at 10MB/s, and a file system shows the growing file the whole time. An object store shows nothing until the upload completes. Versioning also gives reproducibility for free: a run pinned to version ids can be repeated on the same bytes months later.",
          flips:
            "A single machine that runs both the scrapers and the model, where a write-to-temp-then-rename gives the same atomicity and there is nothing to sync.",
        },
      },
    },
    {
      id: "catalog",
      label: "Catalog",
      kind: "database",
      sub: "Postgres: files, snapshots, runs",
      col: 3,
      row: 0,
      detail: {
        what: "A relational table of every file version and the snapshots that group them, plus the run that used each snapshot.",
        why: "The object store knows about bytes; the Catalog knows what they mean. It answers which files are current, which fixtures a file touches, and whether a source is rerun-worthy. A snapshot is a row that lists one version per source at one moment. Pinning a run to a snapshot id is what makes a run repeatable and what lets the gateway tell a stale model from a fresh one.",
        numbers: [
          { value: "~2,500 file rows and ~70 snapshots a day", explain: "One row per object event; one snapshot per run, so the daily run plus up to ~60 reruns on a Saturday." },
          { value: "row count vs 7-day median, quarantine under 20%", explain: "The schema and volume check that catches an empty or broken scrape before it becomes a snapshot." },
        ],
        breaks: {
          failure: "The store's event notification is delivered late or twice, so a file is registered after the snapshot that should have held it, or registered twice.",
          handled:
            "Registration is idempotent on (key, version). A 5-min reconciliation job lists the store and registers anything the events missed. A snapshot sealed without a file is not wrong, it is just older, and the next trigger seals a newer one.",
        },
        choice: {
          pick: "Postgres, with snapshots as explicit rows",
          instead: "No catalog: the run lists the bucket at start and takes the newest version of everything.",
          decider:
            "Reproducibility and staleness both need a name for a moment. Listing the bucket at start gives a run a set of versions nobody recorded, so it cannot be repeated and nothing can say whether a later file made it stale. ~70 snapshot rows a day and ~2,500 file rows is trivial for Postgres.",
          flips: "A single daily run with no reruns and no audit requirement, where the day's bucket listing is a good enough snapshot.",
        },
      },
    },
    {
      id: "orchestrator",
      label: "Orchestrator",
      kind: "service",
      sub: "schedule, triggers, one at a time",
      col: 3,
      row: 1,
      detail: {
        what: "The service that decides when a model run happens, what it covers, and which run wins when two are asked for.",
        why: "The model has two rhythms, a full run at 06:00 and reruns driven by events, and a Python script cannot arbitrate between them. The Orchestrator schedules the daily run and listens for rerun-tagged sources in the Catalog. It coalesces triggers for 30s, scopes the rerun to the fixtures those files touch, and runs one job per model at a time. A job that is still queued when a newer trigger arrives is replaced, so the model never runs on inputs already superseded.",
        numbers: [
          { value: "30s coalesce window", explain: "A lineup sheet often arrives as several files seconds apart. Waiting 30s turns them into one run and costs 30s of a 5-min budget." },
          { value: "~15 reruns a normal day, ~60 on a Saturday", explain: "Roughly one per fixture whose lineup or weather changes inside the window; ~2 min each, so even a Saturday is ~2 hours of runner time." },
          { value: "one run per model at a time", explain: "The runner's cache and the scope logic assume one writer. Parallel reruns of the same model on different snapshots would race on which run is newest." },
        ],
        breaks: {
          failure: "The Orchestrator restarts mid-run and forgets the job, so the run finishes but is never marked complete and the next trigger starts a duplicate.",
          handled:
            "Jobs live in the Catalog's runs table with a state, not in memory. On restart the Orchestrator reads running jobs and asks the runner for their state. A run that completed while it was away is marked complete from its run_published message, which the runner sends with the run_id.",
        },
        choice: {
          pick: "A small purpose-built service over a jobs table, with cron for the daily run",
          instead: "Airflow, a DAG scheduler, with a sensor task waiting for files.",
          decider:
            "The hard part is coalescing and supersession, not dependency graphs. Airflow schedules a DAG at fixed times and its sensors poll on the order of 1 min, which spends a fifth of the 5-min budget waiting. The whole Orchestrator is a few hundred lines over a Postgres table.",
          flips: "When the model becomes a graph of ten dependent steps with retries, which is exactly what a DAG scheduler is for.",
        },
      },
    },
    {
      id: "runner",
      label: "Model runner",
      kind: "service",
      sub: "Python, local NVMe cache",
      col: 2,
      row: 1,
      detail: {
        what: "A worker that makes a snapshot real on local disk, runs the Python model over it, and writes the odds.",
        why: "The model requires CSV files on local disk, so something has to put them there quickly. The runner keeps a content-addressed cache: every file is stored under the hash of its bytes, and the snapshot is a directory of links into it. Making a snapshot local means pulling only hashes not already present. For a lineup rerun that is ~2MB; the cache holds the rest. The model then runs unchanged on a plain directory of CSV.",
        numbers: [
          { value: "~2MB pulled for a rerun, ~8GB for the daily run", explain: "The daily run brings the day's new files; a rerun brings only the file that triggered it, because everything else is cached by hash." },
          { value: "~2 min scoped, ~25 min full", explain: "On a 16-core box. Scope is a list of fixture ids the model prices; the rest of the snapshot is read for context but not priced." },
          { value: "~10,000 rows per full run", explain: "400 fixtures × 25 markets, one row per selection at ~3 per market gives ~30k selections; the store keeps one row per selection." },
        ],
        breaks: {
          failure: "The model crashes half way through writing, leaving a run with some fixtures priced and others not, and the gateway shows a mix of two runs.",
          handled:
            "Rows are written under the run_id in one transaction per fixture, and a run is marked complete only after the last fixture commits. The gateway loads only complete runs. A crashed run is left incomplete, its rows ignored, and the Orchestrator retries the job once before paging.",
        },
        choice: {
          pick: "Content-addressed local cache, snapshot as a directory of links, model untouched",
          instead: "Mount the object store as a file system so the model reads it directly.",
          decider:
            "A file-system mount over object storage turns every read into an HTTP request at ~20ms, and a pandas load that reads a file in 4KB pages makes thousands of them. The model reads ~8GB; a local NVMe disk reads that in ~10s, the mount in ~20 min. The cache also means a rerun does not re-download the 8GB it already has.",
          flips: "A model rewritten to read from a query engine over Parquet, where local files stop being the interface at all.",
        },
      },
    },
    {
      id: "odds-store",
      label: "Odds store",
      kind: "database",
      sub: "Postgres: every run, never updated",
      col: 2,
      row: 2,
      detail: {
        what: "The table of every model output row of every run, keyed by run_id, fixture, market and selection.",
        why: "Model output is a fact about one run, not a mutable current price. Keeping every run means a trader can see what the model said at 14:02 and 14:40 and why they differ. It is small: a full run is ~10,000 rows, a rerun a few hundred, a year ~11GB.",
        numbers: [
          { value: "~150k rows a day, ~11GB a year", explain: "One full run at ~10,000 rows plus reruns averaging a few hundred rows across ~15 to 60 a day, at ~200B a row." },
          { value: "read once per run per gateway", explain: "The gateway loads a run's rows on run_published, ~10,000 rows in ~50ms; traders never query this table on the hot path." },
        ],
        breaks: {
          failure: "Two runs for the same fixture complete out of order, an older scoped rerun after a newer full run, and the older one is taken as current.",
          handled:
            "Current is not the latest to complete but the newest snapshot_id among complete runs for that fixture. Snapshot ids are monotonic from the Catalog, so an older run that lands late is simply never current. Its rows are kept for the audit trail.",
        },
        choice: {
          pick: "Postgres, append-only rows, current derived by newest snapshot per fixture",
          instead: "Overwrite a current_odds table on every run, with a history table on the side.",
          decider:
            "Ordering. At ~70 runs a day some complete out of order, and an overwrite makes the last writer current whatever its snapshot. Deriving current from the snapshot id is one index and cannot go backwards. ~150k rows a day needs nothing beyond a single Postgres.",
          flips: "Millions of rows per run, where the derived-current query over a run's rows stops fitting in the ~50ms the gateway load allows.",
        },
      },
    },
    {
      id: "bus",
      label: "Odds bus",
      kind: "queue",
      sub: "Kafka: market deltas, run events",
      col: 1,
      row: 2,
      detail: {
        what: "A log carrying two kinds of message: a changed market price, and a run_published announcement.",
        why: "The gateway needs one place to hear about both feeds, and a log lets it replay from its last offset after a restart instead of asking the ingester to resend. It also decouples the ingester's pace from the gateway's: a slow gateway falls behind on the log rather than back-pressuring the vendor connection.",
        numbers: [
          { value: "≤ ~7,000 messages/s, ~1MB/s", explain: "~5,000 in-play changes/s at peak plus ~2,000/s from the pre-match sweep after dedup, at ~150B each." },
          { value: "24h retention", explain: "Enough to rebuild the gateway's whole book from the log, and to answer what the market showed at any time today." },
        ],
        breaks: {
          failure: "A consumer restarts and replays 24h of prices into an empty book, showing traders a day of stale prices flickering past.",
          handled:
            "The gateway rebuilds its book silently from the log before it accepts a single WebSocket connection, and only the final state is served. Rebuilding ~600M messages at ~1M/s takes ~10 min, so a compacted snapshot topic keyed by price id brings that to under a minute.",
        },
        choice: {
          pick: "Kafka with a compacted prices topic and a plain events topic",
          instead: "Redis pub/sub, which is simpler and has lower latency.",
          decider:
            "Recovery. Pub/sub keeps nothing, so a gateway restart would need the ingester to re-poll 300k prices, ~20s of vendor calls at the 20-request limit. A log keeps the last value per price under compaction and the gateway rebuilds alone in under a minute. The ~5ms of extra latency is nothing against a 1s target.",
          flips: "One gateway on the same box as the ingester with no restart story needed, where an in-process channel does the job.",
        },
      },
    },
    {
      id: "bookmakers",
      label: "Bookmaker APIs",
      kind: "external",
      sub: "~10 books, poll + stream",
      col: 0,
      row: 3,
      detail: {
        what: "Third-party odds feeds: a REST API for pre-match prices and a streaming feed for in-play.",
        why: "The traders' whole job is the gap between the model and these numbers, so their freshness is the platform's freshness. The vendor sets the rules: ~20 requests a second per key, one fixture per request, and a stream for in-play that pushes every change.",
        numbers: [
          { value: "20 requests/s per key", explain: "400 pre-match fixtures at one per request is a 20s sweep at the limit; the design polls every 30s to leave headroom for retries." },
          { value: "~5,000 changes/s in play", explain: "Up to ~30 fixtures in play at once, each moving several prices on every event; this is the peak the ingester and bus are sized for." },
        ],
        breaks: {
          failure: "The vendor renames a team or a market, and every price for that fixture stops mapping onto our ids and silently disappears from the screen.",
          handled:
            "The ingester counts unmapped prices per bookmaker per minute and raises an alert above 1%. Unmapped prices are kept in a holding table so that adding the mapping backfills them. The screen shows a bookmaker column as missing rather than blank.",
        },
      },
    },
    {
      id: "ingester",
      label: "Market ingester",
      kind: "service",
      sub: "normalise, dedup, sequence",
      col: 1,
      row: 3,
      detail: {
        what: "The service that pulls prices from every bookmaker, maps them onto our ids, drops what has not changed, and publishes the rest.",
        why: "Every bookmaker names teams and markets its own way, so a mapping table is the real work here, and a person maintains it. The ingester also decides what is a change: it keeps the last value per price and publishes only when the value differs. Each published change carries a sequence number per price, so the gateway can tell a replay from a move.",
        numbers: [
          { value: "~10,000 prices/s polled, ~2,000/s published", explain: "300k prices swept every 30s is 10k/s; around 80% come back unchanged, so the bus sees ~2k/s from pre-match." },
          { value: "30s pre-match, ~50ms in play", explain: "The poll sweep is bounded by the vendor's 20 requests a second; the in-play stream pushes each change as it happens." },
        ],
        breaks: {
          failure: "The streaming connection drops for 20s during a match and the book holds prices that have moved several times.",
          handled:
            "On reconnect the ingester does one full poll of the in-play fixtures, ~30 requests, and publishes every difference; the gateway marks those fixtures as reconnecting for the gap. The traders see a 20s hole labelled as such rather than a stale price presented as live.",
        },
        choice: {
          pick: "One stateful ingester per vendor, publishing changes only, with sequence numbers",
          instead: "Publish every polled price to the bus and let the gateway decide what changed.",
          decider:
            "5× the bus traffic for nothing: ~10,000 polled prices a second against ~2,000 real changes. The dedup needs the last value per price, which is ~60MB, so it lives in one process. Sequence numbers cost 8 bytes and make replay after a restart safe.",
          flips: "A vendor whose feed already sends only changes with its own sequence, where the ingester reduces to a mapper.",
        },
      },
    },
    {
      id: "gateway",
      label: "Trader gateway",
      kind: "service",
      sub: "in-memory book, edge, WebSocket",
      col: 2,
      row: 3,
      detail: {
        what: "The service that holds the whole book in memory, computes the edge on every change, and pushes deltas to each trader's screen.",
        why: "Twenty screens and ~7,000 changes a second is not a database problem; it is one process's worth of state. The book is the newest model row per selection and the latest price per bookmaker. On a market delta it recomputes one edge and pushes it to the screens watching that fixture. On run_published it loads the run's rows from the Odds store and pushes the fixtures that changed. Every push carries a sequence number so a screen that reconnects asks for everything after the last one it saw.",
        numbers: [
          { value: "~60MB in memory", explain: "300k prices × ~200B plus ~10,000 model rows; one process with a warm standby that follows the same bus." },
          { value: "~1,000 deltas/s per screen in play, ~120KB/s", explain: "A screen watching ~50 fixtures gets its share of ~7,000 changes/s; at ~120B a message that is ~120KB/s, and 20 screens are ~2.4MB/s." },
          { value: "~100ms vendor to screen", explain: "Ingester ~50ms, bus ~5ms, recompute and push ~50ms, against a 1s in-play target." },
        ],
        breaks: {
          failure: "A screen shows a model price beside a market price from a different moment and the edge between them is a fiction.",
          handled:
            "Every model row carries as_of and snapshot_id. The gateway compares the snapshot with the Catalog's newest for that fixture and greys the fixture with rerun pending when they differ. The model's age is drawn beside every edge, so a 40-min-old price is visibly 40 min old.",
        },
        choice: {
          pick: "One stateful gateway process with a warm standby, deltas over a WebSocket",
          instead: "A stateless API over Redis, with screens polling every second.",
          decider:
            "20 screens polling ~37k prices a second each is ~750k reads a second to show ~1,000 changes. A WebSocket sends the ~1,000 and nothing else. The state is ~60MB, so replicating it into Redis buys nothing that a standby following the same bus does not.",
          flips: "Hundreds of screens across regions, where one process cannot hold every socket and a fan-out tier over pub/sub becomes worth its complexity.",
        },
      },
    },
    {
      id: "ui",
      label: "Trader UI",
      kind: "client",
      sub: "~20 seats, grid per fixture",
      col: 3,
      row: 3,
      detail: {
        what: "A browser grid, one row per selection: model probability and fair odds, each bookmaker's price, and the edge between them.",
        why: "Traders are few and expert, so the screen is dense and fast rather than pretty. It shows the model's age and a rerun pending state so a stale figure never looks live, and it lets a trader press rerun now for a fixture. On reconnect it sends the last sequence number it saw and receives only what it missed.",
        numbers: [
          { value: "~20 seats", explain: "The whole user base; it is why the gateway is one process rather than a fleet." },
          { value: "~50 fixtures per screen", explain: "A trader's working set for a day; subscriptions are per fixture so the gateway pushes only what a screen is watching." },
        ],
        breaks: {
          failure: "A laptop sleeps, wakes, and the grid shows the prices from before the nap as if they were live.",
          handled:
            "Every price on screen carries its received time, and the grid greys anything older than 5s in play or 60s pre-match. On wake the socket reconnects with the last sequence number and the gateway sends a fresh snapshot when the gap is too large to replay.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "sources",
      to: "scrapers",
      tier: "data",
      label: "pages, API responses",
      detail: {
        what: "The scrapers fetching pages and feed responses on their schedules, or on demand.",
        why: "This is the boundary the design does not control. A source can be slow, down, or changed, and each scraper handles that alone; the design only insists on what happens to the file afterwards.",
        numbers: [{ value: "1-min cadence for lineup sources in the hour before kick-off", explain: "The tightest schedule; it puts up to 60s at the front of the rerun budget." }],
        breaks: {
          failure: "A source rate-limits a scraper and the lineup file never arrives, so the rerun never triggers and the model prices a fixture without its lineup.",
          handled:
            "The Catalog expects each source on its schedule and raises a missing-file alert at 2× the expected interval. Fixtures whose lineup source is missing are flagged data_stale in the odds rows and greyed on the screen.",
        },
      },
    },
    {
      id: "e2",
      from: "scrapers",
      to: "blob",
      tier: "hot",
      step: 1,
      label: "CSV, one object per scrape",
      detail: {
        what: "One atomic upload per scrape to a versioned key of source, date and time.",
        why: "The only change asked of the scrapers, and the one everything else rests on. The object appears only when complete, so a reader never sees half a file, and a repeat scrape is a new version rather than an overwrite.",
        numbers: [
          { value: "~2,500 uploads a day", explain: "One per scrape; the upload of a 5MB file takes well under 1s, the 400MB export ~4s over a multipart upload." },
        ],
        breaks: {
          failure: "A scraper writes the CSV to local disk first and uploads a file it has not finished writing, defeating the atomic upload.",
          handled:
            "The upload helper each scraper calls closes the file before uploading and compares the object's ETag with the file's checksum after. A mismatch deletes the version and retries once, then alerts.",
        },
      },
    },
    {
      id: "e3",
      from: "blob",
      to: "catalog",
      tier: "control",
      label: "object-created event",
      detail: {
        what: "The store's notification for every new object version, consumed by the Catalog.",
        why: "It is how a file becomes a fact the system knows about without anyone polling a bucket. The Catalog registers key, version, size, checksum, and reads the header for row count and produced_at.",
        numbers: [{ value: "~1s from upload to registered", explain: "Event delivery is typically under 1s; the row count read of a 5MB file is milliseconds." }],
        breaks: {
          failure: "Event notifications are at-least-once and can arrive late, so a file is registered twice or after the snapshot it belonged to.",
          handled:
            "Registration is idempotent on (key, version), and a reconciliation job lists the store every 5 min and registers anything missed. A late file simply seals the next snapshot rather than corrupting the last one.",
        },
      },
    },
    {
      id: "e4",
      from: "catalog",
      to: "orchestrator",
      tier: "hot",
      step: 2,
      label: "new snapshot, rerun-tagged",
      detail: {
        what: "The Catalog telling the Orchestrator that a rerun-tagged source has a new file, with the fixtures it touches.",
        why: "This is what turns a lineup landing into a rerun without anyone watching a folder. The Catalog knows the source's rerun policy and which fixture ids the file names, so the trigger already carries the scope.",
        numbers: [
          { value: "~15 to ~60 triggers a day", explain: "One per lineup or weather file inside the pre-match window, before the 30s coalesce merges the ones that arrive together." },
        ],
        breaks: {
          failure: "A historical export tagged rerun by mistake triggers a 25-min full-scope rerun in the middle of the afternoon.",
          handled:
            "Scope is derived from the fixtures a file names, and a file naming more than 50 fixtures is scheduled for the daily run whatever its tag. A rerun that would take over 5 min is refused and logged rather than started.",
        },
      },
    },
    {
      id: "e5",
      from: "orchestrator",
      to: "runner",
      tier: "hot",
      step: 3,
      label: "job: run_id, snapshot, scope",
      detail: {
        what: "One job handed to the runner: a fresh run_id, the snapshot to pin to, and the fixture ids to price.",
        why: "Everything the runner needs is in the job, so the runner is stateless apart from its cache and can be replaced. The snapshot id is what makes the run repeatable; the scope is what makes it 2 min rather than 25.",
        numbers: [{ value: "one job in flight per model", explain: "The Orchestrator never sends a second job until run_published or a failure comes back for the first." }],
        breaks: {
          failure: "The runner accepts a job, dies, and the Orchestrator waits for ever for a run_published that never comes.",
          handled:
            "Every job has a deadline of 2× its expected duration, 5 min for a rerun and 50 min for the full run. Past the deadline the Orchestrator marks the run failed, retries once on a fresh runner, and pages after that.",
        },
      },
    },
    {
      id: "e6",
      from: "blob",
      to: "runner",
      tier: "hot",
      step: 4,
      label: "pull changed objects",
      detail: {
        what: "The runner fetching every object in the snapshot whose content hash is not already in its local cache.",
        why: "This is how a local-disk requirement and a 5-min rerun budget coexist. The snapshot lists ~2,500 files; the cache already holds almost all of them, so a rerun pulls the one lineup file that changed.",
        numbers: [
          { value: "~2MB for a rerun, ~8GB for the daily run", explain: "Only versions not yet cached; the daily run is the first to see each day's files." },
          { value: "~40s for 8GB at ~200MB/s", explain: "The full pull inside the same region; a rerun's ~2MB is under 1s." },
        ],
        breaks: {
          failure: "The local disk fills with a year of cached versions and the pull fails half way, leaving a snapshot that is not complete on disk.",
          handled:
            "The cache evicts by last use above 80% of the disk, and a snapshot is a directory built only after every file is present and its hash verified. The model is started on the directory, never on the cache, so a half-pulled snapshot cannot be read.",
        },
      },
    },
    {
      id: "e7",
      from: "runner",
      to: "odds-store",
      tier: "hot",
      step: 5,
      label: "odds rows, run_id",
      detail: {
        what: "The model's output written as rows under the run's id, one transaction per fixture, then the run marked complete.",
        why: "Writing per fixture keeps a crash from leaving half a fixture priced, and marking complete last keeps the gateway from loading a run that is still being written.",
        numbers: [
          { value: "~10,000 rows for a full run, ~300 for a rerun", explain: "One per selection; a rerun covers the handful of fixtures in its scope." },
        ],
        breaks: {
          failure: "The model produces a probability of 1.4 or a set of selections summing to 0.7 because of a bad input row, and it is stored as if true.",
          handled:
            "The writer validates every fixture: probabilities in (0, 1) and a market's selections summing to 1 within 1%. A failing fixture is written with a rejected flag and not priced, and the previous run stays current for it.",
        },
      },
    },
    {
      id: "e8",
      from: "runner",
      to: "bus",
      tier: "data",
      label: "run_published {run_id}",
      detail: {
        what: "One message announcing that a run is complete, with its run_id, snapshot_id and the fixtures it priced.",
        why: "It is the one signal the gateway and the Orchestrator both need. The gateway loads the run; the Orchestrator marks the job done and releases the next one. Putting it on the bus rather than calling either directly means a restarted service still finds it.",
        numbers: [{ value: "~70 messages a day", explain: "One per run; it is the rarest message on the bus and the one that changes the most on a screen." }],
        breaks: {
          failure: "The runner commits the last fixture and dies before publishing, so the run is complete in the store but nobody is told.",
          handled:
            "The Orchestrator's deadline check reads the runs table, finds the run complete, and publishes run_published itself. Publishing is idempotent on run_id, so a runner that recovers and publishes too is harmless.",
        },
      },
    },
    {
      id: "e9",
      from: "gateway",
      to: "odds-store",
      tier: "data",
      label: "load run on publish",
      detail: {
        what: "The gateway reading a completed run's rows when it sees run_published, and the Catalog's newest snapshot per fixture with them.",
        why: "This is the only read of the Odds store on the live path, ~10,000 rows once per run. Reading the snapshot id beside the rows is what lets the gateway say whether the model is current for each fixture.",
        numbers: [{ value: "~50ms per full run, ~70 times a day", explain: "10,000 rows over an index on run_id; a rerun is a few hundred rows." }],
        breaks: {
          failure: "A rerun for 3 fixtures is loaded and the gateway replaces the whole book's model rows, wiping the other 397 fixtures.",
          handled:
            "The load merges by fixture: only the fixtures the run priced are replaced, and only if the run's snapshot_id is newer than the one the gateway holds for that fixture. A late older run changes nothing.",
        },
      },
    },
    {
      id: "e10",
      from: "bookmakers",
      to: "ingester",
      tier: "data",
      label: "prices, poll + stream",
      detail: {
        what: "The pre-match REST sweep every 30s and the in-play streaming connection, one per bookmaker.",
        why: "Two transports because the vendor offers two, and because pre-match prices move slowly enough that polling is fine while in-play prices move on every event.",
        numbers: [
          { value: "~14 requests/s pre-match", explain: "400 fixtures every 30s, well inside the 20 requests a second limit, leaving room for retries and the reconnect poll." },
          { value: "~5,000 messages/s in play at peak", explain: "Up to ~30 fixtures in play, each pushing several prices per event." },
        ],
        breaks: {
          failure: "A poll takes longer than 30s because the vendor is slow, and the next sweep starts on top of it, doubling the request rate past the limit.",
          handled:
            "Sweeps do not overlap: a sweep that overruns delays the next, and the screen's freshness marker shows the real age. Above 60s the ingester alerts and the gateway greys pre-match prices as stale.",
        },
      },
    },
    {
      id: "e11",
      from: "ingester",
      to: "bus",
      tier: "hot",
      step: 6,
      label: "changed prices only",
      detail: {
        what: "One message per price that actually moved, keyed by price id, with a per-price sequence number.",
        why: "Publishing only changes is what keeps the bus at ~1MB/s and the screens at ~1,000 deltas a second rather than ~37,000. The sequence number lets the gateway drop a replayed message it has already applied.",
        numbers: [
          { value: "~7,000 messages/s at peak, ~150B each", explain: "~2,000/s from the sweep after dedup plus ~5,000/s in play; about 1MB/s." },
        ],
        breaks: {
          failure: "The ingester restarts, loses its last-value table, and republishes all 300k prices as changes in one burst.",
          handled:
            "On start the ingester rebuilds its last-value table from the compacted prices topic before polling, ~1 min, so its first sweep publishes only real changes. If it cannot, it publishes with a resync flag and the gateway applies them without pushing unchanged values to screens.",
        },
      },
    },
    {
      id: "e12",
      from: "bus",
      to: "gateway",
      tier: "hot",
      step: 7,
      label: "model runs + market deltas",
      detail: {
        what: "The gateway consuming both topics: price changes to update the book, run_published to load a new run.",
        why: "One consumer, one ordering, one place where a model price and a market price meet. The gateway's offset is its recovery point: after a restart it rebuilds from the compacted topic and resumes from where it was.",
        numbers: [
          { value: "~5ms bus latency", explain: "Producer to consumer on a local cluster; the cheapest hop in the ~100ms vendor-to-screen path." },
        ],
        breaks: {
          failure: "The gateway falls behind under an in-play burst and screens show prices from 10s ago as live.",
          handled:
            "The gateway tracks its lag against the newest offset and, above 1s, marks every pushed price with its real age so the screen greys it. A single process applies ~7,000 changes a second in well under 10% of one core, so lag is a signal of something broken, not of load.",
        },
      },
    },
    {
      id: "e13",
      from: "gateway",
      to: "ui",
      tier: "hot",
      step: 8,
      label: "WebSocket deltas, seq",
      detail: {
        what: "A snapshot of the subscribed fixtures on connect, then one delta per change, each with the gateway's sequence number.",
        why: "Snapshot then stream is what makes a reconnecting screen correct. It asks for everything after the last sequence it saw, and gets a fresh snapshot instead when the gap is too old to replay.",
        numbers: [
          { value: "~1,000 deltas/s per screen in play, ~120KB/s", explain: "A screen watching ~50 fixtures; 20 screens are ~2.4MB/s, nothing for one process." },
          { value: "~50ms recompute and push", explain: "One subtraction per change and a write to each subscribed socket." },
        ],
        breaks: {
          failure: "A delta is delivered after the snapshot that already contained it, and the screen shows an older price over a newer one.",
          handled:
            "Every delta carries the price's sequence number and the screen applies a delta only if it is newer than what it holds. The snapshot carries the sequence of every price in it, so the rule needs no clock.",
        },
      },
    },
    {
      id: "e14",
      from: "ui",
      to: "orchestrator",
      tier: "control",
      label: "rerun now (manual)",
      detail: {
        what: "A trader asking for a rerun of one fixture, on the newest snapshot, right now.",
        why: "The scrapers cannot know everything. When a trader hears something the sources have not published, the fastest honest answer is a rerun on what the model does have. The result is labelled by its snapshot like any other.",
        numbers: [{ value: "same ~3.5-min path, minus the scrape", explain: "A manual rerun skips the ≤ 60s scrape and the 30s coalesce, so it lands in ~2 min." }],
        breaks: {
          failure: "Several traders press rerun for the same fixture within a minute and the runner spends the afternoon repeating itself.",
          handled:
            "The Orchestrator coalesces manual triggers like any other and refuses a rerun whose snapshot equals the one the fixture's current run already used. The screen shows already current instead of starting a job.",
        },
      },
    },
  ],
  figures: {
    snapshot: {
      title: "A snapshot: one version per source, sealed under an id, pinned by a run",
      nodes: [
        { id: "f1", label: "lineups.csv v7", sub: "14:02:10, 12KB", kind: "blob", col: 0, row: 0 },
        { id: "f2", label: "weather.csv v31", sub: "13:58:40, 40KB", kind: "blob", col: 0, row: 1 },
        { id: "f3", label: "results.csv v3", sub: "06:00, 400MB", kind: "blob", col: 0, row: 2 },
        {
          id: "snap",
          label: "Snapshot 4,812",
          sub: "one version per source",
          kind: "database",
          col: 1,
          row: 1,
          detail: {
            what: "A Catalog row listing exactly one version of every source at 14:02:41.",
            why: "The id names a moment. A run pinned to it reads the same bytes for ever, and a newer snapshot for a fixture is what makes the run's odds stale.",
          },
        },
        {
          id: "run",
          label: "Run 9,331",
          sub: "scope: fixtures 12, 18",
          kind: "service",
          col: 1,
          row: 2,
          detail: {
            what: "The job the Orchestrator sends: run_id, snapshot_id and the fixtures to price.",
            why: "The snapshot makes it repeatable; the scope makes it ~2 min. Every odds row it writes carries both ids.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "f1", to: "snap", tier: "hot", step: 1, label: "newest version" },
        { id: "e2", from: "f2", to: "snap", tier: "data", label: "newest version" },
        { id: "e3", from: "f3", to: "snap", tier: "data", label: "unchanged since 06:00" },
        { id: "e4", from: "snap", to: "run", tier: "hot", step: 2, label: "pinned" },
      ],
    },
    connect: {
      title: "Snapshot then stream: a screen is correct after any reconnect",
      nodes: [
        { id: "screen", label: "Trader UI", sub: "last seen seq 1,204", kind: "client", col: 0, row: 0 },
        {
          id: "gw",
          label: "Trader gateway",
          sub: "book in memory, seq 1,391",
          kind: "service",
          col: 0,
          row: 1,
          detail: {
            what: "The one process holding the newest model row and the latest market price for every selection.",
            why: "On connect it sends a snapshot stamped with the sequence of every price in it, then every change after. A screen applies a delta only if it is newer than what it holds.",
          },
        },
        {
          id: "snapmsg",
          label: "Snapshot",
          sub: "50 fixtures, every price with seq",
          kind: "cache",
          col: 1,
          row: 0,
          detail: {
            what: "The full state of the subscribed fixtures at the moment of connect.",
            why: "Sent when the gap since the screen's last sequence is too old to replay, or on first connect. It carries a sequence per price, so a late delta cannot overwrite it.",
          },
        },
        {
          id: "deltas",
          label: "Deltas",
          sub: "only seq > 1,391, ~1,000/s in play",
          kind: "queue",
          col: 1,
          row: 1,
          detail: {
            what: "One message per price that moved after the snapshot.",
            why: "Only what changed, only for the subscribed fixtures; the sequence number is the only ordering the screen needs.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "screen", to: "gw", tier: "hot", step: 1, label: "subscribe, seq 1,204" },
        { id: "e2", from: "gw", to: "snapmsg", tier: "hot", step: 2, label: "gap too old: snapshot" },
        { id: "e3", from: "gw", to: "deltas", tier: "hot", step: 3, label: "then stream" },
      ],
    },
  },
};
