import type { Diagram } from "./types";

export const CHATGPT: Diagram = {
  id: "chatgpt",
  title: "LLM Chat App",
  question: "Design ChatGPT (an LLM Chat Application)",
  sourceId: "patterns",
  itemId: 58,
  overview: {
    shape:
      "A stateless chat tier over a stateful conversation store. Every turn rebuilds its prompt from history under a fixed token budget and streams tokens as they are generated. The turn is buffered server-side, so any node can resume it.",
    forces: [
      {
        constraint: "500M turns a day, and each turn is an ~8-second stream, not a request",
        decision: "The Edge gateway terminates ~160k concurrent SSE streams at peak; everything behind it works in short stateless steps",
        lights: ["gateway", "e1", "e7"],
      },
      {
        constraint: "A 200-turn conversation replayed in full is a ~100k-token prompt, paid on every turn",
        decision: "The Chat service rebuilds each prompt under an 8k budget: system text, a rolling summary from the Summarizer, and the recent turns",
        lights: ["chat-svc", "convo-store", "summarizer", "e3", "e12"],
      },
      {
        constraint: "~800B tokens a day of inference, the dominant cost of the whole product",
        decision: "The Model router sends turns to the smallest model that can answer them, and Usage metering prices every token against the Quota store",
        lights: ["router", "metering", "billing", "e5", "e10"],
      },
      {
        constraint: "Output must be checked for safety, but the user is watching tokens arrive at ~50/s",
        decision: "The Moderation service classifies the input before inference and scans the output in ~50-token chunks, cutting the stream mid-sentence if it must",
        lights: ["moderation", "e4"],
      },
      {
        constraint: "A turn lives for ~8 seconds but no single server is allowed to own it",
        decision: "The completion is written to the Conversation store as it streams, so a dropped connection resumes from the buffer by turn id and offset",
        lights: ["chat-svc", "convo-store", "e3"],
      },
    ],
    naive: {
      text: "One service takes the message, calls the model, and returns the whole completion as one JSON response; the client resends the entire conversation every turn as its memory. Three numbers kill it. A 400-token answer at ~50 tokens/s means the user stares at a spinner for ~8 to 12 seconds instead of reading from ~600ms. At ~20k turns/s peak, requests that block for 8 seconds are ~160,000 concurrent held requests in a tier with no reason to hold them. And resending history makes the prompt grow with the conversation: a long thread costs ~100k tokens every single turn, ~12x the price of a budgeted prompt. Streaming, server-held history and a token budget are each worth roughly an order of magnitude.",
      lights: ["gateway", "chat-svc", "convo-store"],
    },
    beats: [
      {
        text: "The Client apps speak one protocol: send a message, receive a stream. The Edge gateway authenticates the user, checks the Quota store, and holds the response open as an SSE stream. SSE is a one-way stream of events over plain HTTP, which is all a chat turn needs downstream. At ~20k turns/s peak and ~8s per stream that is ~160k open connections, about 8k per gateway node across ~20 nodes.",
        lights: ["client", "gateway", "e1", "e2", "e9"],
      },
      {
        text: "The Chat service owns the turn but no state. It loads the conversation from the Conversation store: the pinned system text, the rolling summary, and the recent turns verbatim. It assembles a prompt under an 8k-token budget and hands it on. Because every turn rebuilds from the store, any chat node can serve any turn, and the tier scales as plain stateless compute.",
        lights: ["chat-svc", "convo-store", "e3"],
      },
      {
        text: "The budget is arithmetic, not taste. System text ~300 tokens, rolling summary ~500, the last ~10 turns ~5,500, the new message ~300: ~6,600 of 8,000, leaving headroom for tool output. The Summarizer keeps this possible: past ~6k stored tokens it folds the oldest turns into the summary. History stays bounded while the model still knows what was said an hour ago.",
        lights: ["summarizer", "convo-store", "e12"],
      },
      {
        text: "Before inference, the Moderation service classifies the input in ~10ms: most turns pass, some get a refusal template, some get flagged and logged. During inference it scans the output in ~50-token chunks, one classifier call per chunk running beside the stream. A verdict mid-generation cuts the stream and replaces the partial answer; the buffered turn is marked removed so refreshes do not resurrect it.",
        lights: ["moderation", "e4"],
      },
      {
        text: "The Model router picks the smallest model that can do the job. Most turns take the small default; opted-in and hard turns take the large model, with provider failover and a brownout rule. When queue depth on the large pool passes its threshold, new free-tier turns degrade to the small model instead of queueing. The LLM inference fleet itself, batching, KV cache, GPU scheduling, is deliberately a single box: this design consumes it.",
        lights: ["router", "inference", "e5", "e6"],
      },
      {
        text: "Tokens stream from the LLM inference fleet through the Edge gateway to the client, and simultaneously append to the turn's buffer in the Conversation store. That double-write is the resumability story. A phone that drops the connection reconnects with the turn id and last offset, and any gateway node replays the rest from the buffer. The same buffer is why a crashed chat node loses nothing visible.",
        lights: ["inference", "gateway", "convo-store", "e7"],
      },
      {
        text: "Usage metering is asynchronous on purpose. The inference fleet emits exact token counts per turn onto the metering queue. A rollup aggregates per user per minute into the Quota store, which the gateway reads on the next turn. A user can overshoot their quota by at most one minute of turns, a bounded cost, in exchange for keeping billing entirely off the hot path.",
        lights: ["metering", "billing", "e10", "e11"],
      },
      {
        text: "The latency budget is spent almost entirely before the first token. Gateway auth and quota ~5ms, history load ~20ms, input moderation ~10ms, router and queue ~100ms, prefill ~400ms: ~535ms to first token against a ~1s target. After that the stream runs at generation speed, and nothing downstream of the model adds per-token latency worth counting.",
        lights: ["gateway", "chat-svc", "moderation", "router", "e6", "e7"],
      },
    ],
    crux: {
      problem:
        "A turn is an 8-second stateful operation running on a tier that must stay stateless. Connections drop mid-answer, clients retry, nodes die, and the same turn must never bill twice or answer twice.",
      handled:
        "The turn's identity does the work. The client sends an idempotency key per turn; a retry with the same key attaches to the existing buffered turn instead of starting a new generation. The completion streams into the Conversation store as it is generated, so resume is a read, not a re-run. What remains: a turn abandoned mid-stream still ran and still cost its tokens, and the metering pipeline bills it. That is charged as generated, not as delivered, and the design accepts the argument.",
    },
    numbers: [
      {
        value: "~160k concurrent streams at peak",
        explain: "50M daily users x ~10 turns is ~500M turns/day, ~20k/s at peak. A turn streams for ~8s (400 tokens at ~50/s), so ~20k/s x 8s = ~160k open connections, ~8k per gateway node.",
      },
      {
        value: "8k-token prompt budget",
        explain: "System ~300 + summary ~500 + last ~10 turns ~5,500 + new message ~300 = ~6,600, with headroom to 8k. Replaying a long conversation verbatim is ~100k tokens, ~12x the cost, for answers that are no better.",
      },
      {
        value: "~800B tokens a day",
        explain: "500M turns x (~1,200 prompt + ~400 completion) tokens. This is why routing most turns to a small model and metering every token are core design pressures, not billing features.",
      },
      {
        value: "~535ms to first token vs ~1s target",
        explain: "Auth + quota ~5ms, history ~20ms, input moderation ~10ms, router + queue ~100ms, prefill ~400ms. Generation speed after that belongs to the inference fleet, not this design.",
      },
      {
        value: "~1TB of new conversation text a day",
        explain: "500M turns x ~2KB stored per turn. Old turns compact into summaries and cold conversations tier out to object storage after 90 days.",
      },
    ],
  },
  nodes: [
    {
      id: "client",
      label: "Client apps",
      kind: "client",
      sub: "web, mobile; render the stream",
      col: 0,
      row: 0,
      detail: {
        what: "The web and mobile apps: they send one message per turn and render a token stream as it arrives.",
        why: "The client is deliberately thin. It holds no conversation state beyond a cursor: the conversation id, the current turn id, and the last stream offset it rendered. That is exactly what a reconnect needs and nothing more.",
        numbers: [
          { value: "~50M daily users, ~10 turns each", explain: "The load base every downstream figure derives from." },
          { value: "2 values to reconnect: turn_id, offset", explain: "The whole resume protocol; the client holds nothing else about the turn." },
        ],
        breaks: {
          failure: "A flaky mobile network drops the stream mid-answer and the user taps retry, risking a second generation of the same turn.",
          handled: "The retry carries the same idempotency key, so the gateway attaches it to the buffered turn already in flight and replays from the last offset. One generation, one bill, however many taps.",
        },
      },
    },
    {
      id: "gateway",
      label: "Edge gateway",
      kind: "gateway",
      sub: "auth, quota, SSE termination",
      col: 1,
      row: 0,
      detail: {
        what: "The tier that authenticates a turn, checks quota, opens the SSE response, and pumps tokens from the inference stream to the client.",
        why: "Holding ~160k open streams is a connection problem, not a compute problem, so it lives in a tier built for it. Everything behind the gateway completes in milliseconds-to-seconds and holds no client connection, which is what lets the chat tier stay small and stateless.",
        numbers: [
          { value: "~160k streams over ~20 nodes", explain: "~8k open SSE connections per node, comfortable for an event-loop server; memory per idle stream is a few KB." },
          { value: "~5ms auth + quota check", explain: "A token verify plus one read of the per-user quota row, cached with a 10s TTL." },
        ],
        breaks: {
          failure: "A gateway node dies holding 8k live streams; every one of those users' answers stops mid-sentence.",
          handled: "Clients auto-reconnect through the load balancer with turn_id and offset, land on any other node, and resume from the turn buffer in the conversation store. The generation itself never stopped, because the inference stream is consumed independently of any one gateway node.",
        },
        choice: {
          pick: "SSE over plain HTTP for the answer stream",
          instead: "WebSocket for a bidirectional channel.",
          decider:
            "The traffic is one-way. A turn is one small upstream message and ~400 tokens downstream; SSE gives that over ordinary HTTP with proxy, retry and reconnect semantics for free. WebSocket buys bidirectionality this product does not use, at the cost of fussier infrastructure at 160k connections.",
          flips: "Real collaboration in the same session, voice, or client-interrupts-the-model UX, where messages genuinely flow both ways mid-turn.",
        },
      },
    },
    {
      id: "chat-svc",
      label: "Chat service",
      kind: "service",
      sub: "stateless; builds prompt to budget",
      col: 2,
      row: 0,
      detail: {
        what: "The stateless orchestrator of one turn: load history, build the prompt under budget, call moderation, hand the prompt to the router, append the result.",
        why: "Every piece of turn state lives in the conversation store, so this tier is pure compute and scales by adding nodes. The prompt build is its real job: pinned system text, the rolling summary, then recent turns newest-first until the budget is spent. The budget is what makes cost per turn flat instead of growing with conversation length.",
        numbers: [
          { value: "~20k turns/s peak, stateless", explain: "Each turn is ~35ms of work in this tier; ~700 cores' worth at peak, trivially horizontal." },
          { value: "prompt ≤ 8k tokens, always", explain: "The hard ceiling the prompt builder packs to; anything older than the recent turns arrives via the summary." },
        ],
        breaks: {
          failure: "A chat node crashes mid-turn after inference started, and nobody is left driving the turn's bookkeeping.",
          handled: "The turn record in the store has a state and a deadline. A sweeper adopts turns whose node lease expired. A finished buffer is finalised; anything else is marked failed, and the client's retry starts clean under the same idempotency key.",
        },
        choice: {
          pick: "Server-held history with a per-turn rebuilt prompt",
          instead: "Client-held history: the app resends the conversation every turn.",
          decider:
            "Cost and truth. Client-replay prompts grow with the thread, ~100k tokens on a long one, ~12x the budgeted cost, and the server cannot enforce a budget on text it must trust. Server-held history makes the prompt a policy, applied identically for every client.",
          flips: "A stateless API product for developers, where the caller owning the context is the contract and billing them for it is the business model.",
        },
      },
    },
    {
      id: "convo-store",
      label: "Conversation store",
      kind: "database",
      sub: "turns, summaries, turn buffers",
      col: 3,
      row: 0,
      detail: {
        what: "The system of record for conversations: every turn's text, the rolling summary, and the in-flight buffer of the turn being generated right now.",
        why: "One store serves three reads that must agree: the prompt builder's history load, the client's rendered thread, and the resume path's buffer replay. Splitting them invites the classic bug where the user sees an answer the model was never told about. Turns are append-only; edits and deletions are tombstones, so moderation removals and user deletions replay correctly everywhere.",
        numbers: [
          { value: "~1TB/day of new turns", explain: "500M turns x ~2KB. Hot conversations stay in the primary store; cold ones tier to object storage after 90 days with ids left behind." },
          { value: "~20ms history load", explain: "One partition read: summary row plus the last ~10 turn rows, keyed by conversation id." },
        ],
        breaks: {
          failure: "The turn buffer takes a write per ~50-token chunk from every active stream: ~160k streams writing every second is a hot append load.",
          handled: "Buffers are chunk-appends to a per-turn row on the conversation's partition, ~160k small writes/s spread across shards, and they are short-lived: on finalise the buffer collapses into one turn row. A missed chunk write degrades resume granularity, never the answer, because the client stream is fed from inference, not from the buffer.",
        },
        choice: {
          pick: "One partitioned store, conversation id as the partition key, append-only turns",
          instead: "A cache for hot threads over a separate archive database.",
          decider:
            "Consistency of the three readers. A cache-over-archive split re-derives the same thread in two places, and a resume served from a cache that missed the last chunk repeats or drops words. Partitioning by conversation id makes every read one partition and keeps a thread's turns ordered by construction.",
          flips: "Read traffic dominated by re-opening old conversations rather than continuing live ones, where a dedicated read tier over the archive earns its consistency risk.",
        },
      },
    },
    {
      id: "billing",
      label: "Quota store",
      kind: "database",
      sub: "per-user balance, plan limits",
      col: 0,
      row: 1,
      detail: {
        what: "The per-user quota and plan record the gateway consults before admitting a turn: tokens used this window, plan ceiling, hard block flag.",
        why: "Admission control needs one cheap read, not an accounting system. The store holds rolled-up usage a minute behind reality, a deliberate trade. The hot path never waits on billing, and the worst case is one extra minute of usage on a just-exhausted quota.",
        numbers: [
          { value: "quota read ~1ms, cached 10s at the gateway", explain: "One row per user; the gateway cache turns 20k reads/s into a light load." },
          { value: "overrun bound: ~1 minute of turns", explain: "The rollup cadence is the honesty window: a user racing their limit gets at most one rollup interval of free overshoot." },
        ],
        breaks: {
          failure: "The rollup pipeline stalls and every quota in the store freezes while usage continues.",
          handled: "The gateway watches the store's high-water timestamp. If rollups are more than 5 minutes stale it applies a per-user local rate cap as a stopgap. A stalled pipeline degrades to coarse fairness instead of unlimited free usage.",
        },
        choice: {
          pick: "Asynchronous rollups read at admission, with a bounded overrun",
          instead: "Synchronous debit: decrement a live balance inside every turn.",
          decider:
            "A synchronous debit puts a global counter write on the path of 20k turns/s and couples chat availability to billing availability. The async design's entire downside is one minute of overshoot, which at ~10 turns is noise against the cost of a billing outage stopping chat.",
          flips: "Prepaid metered API keys where tokens are literally money and overshoot is revenue loss; there the debit belongs on the hot path and the latency is the price.",
        },
      },
    },
    {
      id: "inference",
      label: "LLM inference fleet",
      kind: "service",
      sub: "the serving system, consumed here",
      col: 1,
      row: 1,
      detail: {
        what: "The model serving system: GPU pools per model size, request batching, KV cache, streaming token output. A whole design of its own, consumed here as a dependency.",
        why: "The chat product needs exactly three promises from it: a token stream that starts in ~400ms, exact token counts per turn, and per-pool queue depth it can read. Everything else, batching strategy, cache policy, GPU scheduling, stays behind this box's interface on purpose.",
        numbers: [
          { value: "~800B tokens/day through the pools", explain: "The number that makes the router's small-model default worth more than any other optimisation in this design." },
          { value: "prefill ~400ms, then ~50 tokens/s", explain: "The two latencies the user experiences: time to first token, then reading speed." },
        ],
        breaks: {
          failure: "A model pool degrades: prefill latency doubles and queue depth climbs, and every product on top of it feels it at once.",
          handled: "The router reads queue depth per pool and sheds by tier. Free-tier turns brown out to the small model first, then queue caps reject new turns with a retry hint before the pool collapses. The chat tier never queues on a dying pool.",
        },
        choice: {
          pick: "Consume the serving fleet behind a three-promise interface: stream start, token counts, queue depth",
          instead: "Letting the chat tier talk to GPU pools and batching directly.",
          decider:
            "Change rate. The serving stack retunes weekly, batch sizes, cache policy, pool shapes, while the chat product's three needs have not changed once. Coupling them makes ~500M turns a day hostage to every serving experiment.",
          flips: "A single-team, single-model deployment where the product and the fleet are the same people and the interface is ceremony.",
        },
      },
    },
    {
      id: "router",
      label: "Model router",
      kind: "service",
      sub: "smallest capable model, failover",
      col: 2,
      row: 1,
      detail: {
        what: "The policy layer between the prompt and the GPU pools: choose the model, apply brownout rules, fail over between pools and providers.",
        why: "At ~800B tokens a day, which model answers is the largest cost decision in the system, and it cannot live in client code or config alone. The default is the small model; the large model serves opted-in plans, long prompts, and turns the small model flagged as beyond it. Routing is a per-turn decision made against live pool health.",
        numbers: [
          { value: "~80% of turns on the small model", explain: "At roughly a 10x cost ratio between pools, the mix, not raw volume, is what sets the daily bill." },
          { value: "brownout past ~30s of queued work", explain: "When the large pool's queue passes ~30 seconds of work, free-tier turns route small instead of waiting; paid tiers queue up to a cap." },
        ],
        breaks: {
          failure: "A silent quality regression: a routing tweak sends hard turns to the small model, users see worse answers, and no latency or error metric moves.",
          handled: "A sampled shadow: ~0.1% of small-model turns also run on the large model offline and a judge model compares answers. Divergence above threshold pages the routing owner. Imperfect, and the only guard that catches a quality failure with healthy dashboards.",
        },
        choice: {
          pick: "Tiered routing with brownout, small model as default",
          instead: "One flagship model for everything, sized for peak.",
          decider:
            "The token bill. At ~800B tokens/day and ~10x cost between tiers, moving ~80% of turns to the small pool cuts the dominant cost by most of an order of magnitude. Evaluated answer quality on those turns is indistinguishable.",
          flips: "An enterprise product priced per seat with quality SLAs, where model choice is contractual and the router's job shrinks to failover.",
        },
      },
    },
    {
      id: "summarizer",
      label: "Summarizer",
      kind: "service",
      sub: "folds old turns into a summary",
      col: 3,
      row: 1,
      detail: {
        what: "An async worker that compacts a conversation's oldest turns into a rolling summary once stored history passes a threshold.",
        why: "The prompt budget only works if history is bounded, and truncation alone forgets what the user said an hour ago. The summarizer runs off the hot path, using spare small-model capacity, and rewrites the summary row so the next turn's prompt build finds it ready. The user never waits on it.",
        numbers: [
          { value: "triggers past ~6k stored tokens", explain: "Folds the oldest turns until stored verbatim history is back under budget headroom." },
          { value: "~500-token summary, small model, off-peak", explain: "Summarisation is itself inference; running it on the small pool in spare capacity keeps its cost invisible." },
        ],
        breaks: {
          failure: "A bad summary silently loses a fact the user established early, and every later answer is subtly wrong with no error anywhere.",
          handled: "Summaries are versioned beside the turns they replaced, never destructive, so a user report can be diagnosed and the summary rebuilt from the originals. The residual risk, quiet degradation until someone notices, is real and accepted.",
        },
        choice: {
          pick: "Rolling summary plus verbatim recent turns",
          instead: "Sliding window truncation: keep the last N turns, drop the rest.",
          decider:
            "What the model forgets. Truncation loses everything past the window edge, and long-thread users notice the model forgetting their own constraints. A ~500-token summary keeps the thread's facts for ~6% of the budget, and the failure mode shifts from certain forgetting to occasional lossy compression.",
          flips: "Short-session products where threads rarely pass the window, or retrieval over past turns, where search replaces summarisation entirely.",
        },
      },
    },
    {
      id: "metering",
      label: "Usage metering",
      kind: "queue",
      sub: "token counts per turn, rollups",
      col: 1,
      row: 2,
      detail: {
        what: "The event stream of exact per-turn token counts emitted by the inference fleet, consumed by a rollup job into per-user, per-minute usage.",
        why: "Billing truth comes from the fleet that generated the tokens, not from the tier that asked for them: a crashed chat node cannot lose a billing event it never owned. A log in the middle makes metering replayable, so a rollup bug is fixed by rewinding, not by guessing.",
        numbers: [
          { value: "~500M events/day, ~100B each", explain: "One event per turn: user, turn id, model, prompt and completion token counts. ~50GB/day, trivial for a partitioned log." },
          { value: "1-minute rollup cadence", explain: "The interval that bounds both billing lag and the quota overrun window." },
        ],
        breaks: {
          failure: "Duplicate events: the fleet retries an emit, and a turn bills twice.",
          handled: "Events are keyed by turn id and the rollup dedups within its window. The turn id is the same idempotency key that guards generation, so one turn is one bill by construction.",
        },
        choice: {
          pick: "Event log with turn-keyed dedup and minute rollups",
          instead: "Direct writes from the fleet into the quota store per turn.",
          decider:
            "Replayability. Direct writes make every billing bug a data-loss incident; a retained log makes it a rewind. The cost is one minute of staleness, already accepted by the admission design.",
          flips: "Tiny scale, one region, where a transactional write per turn is affordable and the log is ceremony.",
        },
      },
    },
    {
      id: "moderation",
      label: "Moderation service",
      kind: "service",
      sub: "input classify, output chunk scan",
      col: 2,
      row: 2,
      detail: {
        what: "The safety classifiers: a fast pass over the user's message before inference, and a rolling scan over the model's output as it streams.",
        why: "Both directions need checking and they have different shapes. Input moderation is one ~10ms classification before any GPU is spent. Output moderation cannot wait for the full answer, because the user is reading it live. So it scans overlapping ~50-token chunks, and can cut the stream mid-sentence, replace the partial answer with a refusal, and tombstone the buffer.",
        numbers: [
          { value: "~10ms input pass, in the TTFT budget", explain: "A small classifier, cheap enough to run on every one of 500M turns a day." },
          { value: "~8 output scans per turn", explain: "400 tokens in ~50-token chunks; each scan races the stream so a verdict lands within ~1s of the offending text." },
        ],
        breaks: {
          failure: "The classifier tier degrades, and the choice is stop answering or answer unscanned.",
          handled: "Input moderation fails closed for flagged-history users and open for the rest, with sampling; output moderation falls back to a cheaper pattern tier and queues transcripts for retro-scan. A retro verdict tombstones the stored turn, which is why the store keeps tombstones at all.",
        },
        choice: {
          pick: "Streaming chunk scan with a cut-and-replace verdict",
          instead: "Moderate the complete answer after generation, before showing anything.",
          decider:
            "Latency against exposure. Post-hoc moderation turns an ~8s stream back into an ~8s spinner, undoing the product's defining feature. Chunk scanning bounds exposure to ~1 second of tokens, and the cut-and-replace pattern makes the failure visible and reversible.",
          flips: "High-stakes surfaces, minors, medical, legal, where a ~1s exposure window is unacceptable and the spinner is the right call.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "gateway",
      tier: "hot",
      step: 1,
      label: "message + turn key",
      detail: {
        what: "One turn request: conversation id, the new message, and a client-generated idempotency key; the SSE response streams back on the same connection.",
        why: "The key is minted at the client because the client is the thing that retries. Same key, same turn: a retry attaches to the in-flight generation and replays the buffer from the last offset instead of generating again.",
        numbers: [
          { value: "~20k turns/s peak", explain: "The admission rate the gateway tier is sized for." },
          { value: "2-field resume: turn_id + offset", explain: "The whole reconnect protocol; no other client state exists." },
        ],
        breaks: {
          failure: "A client bug mints a fresh key on retry and the same question generates twice, billing twice.",
          handled: "A server-side guard dedups by (conversation, message hash) within a short window and attaches the second request to the first turn. Coarse, but it converts the common double-tap into one generation.",
        },
      },
    },
    {
      id: "e2",
      from: "gateway",
      to: "chat-svc",
      tier: "hot",
      step: 2,
      label: "authed turn, quota ok",
      detail: {
        what: "The admitted turn handed to a stateless chat node: user, conversation id, message, idempotency key, plan tier.",
        why: "Admission is finished before the chat tier is touched: identity verified, quota read, abuse throttles applied. The chat tier therefore never handles an unauthenticated or over-quota request, and its scaling math is pure turn work.",
        numbers: [{ value: "~5ms spent at the gateway", explain: "Auth verify plus cached quota read; the cheapest stage of the turn." }],
        breaks: {
          failure: "A stolen session token starts burning someone's quota on scripted turns.",
          handled: "Per-device rate caps and velocity checks at the gateway, then a step-up re-auth challenge; the quota lag bounds the damage to minutes of usage either way.",
        },
      },
    },
    {
      id: "e3",
      from: "chat-svc",
      to: "convo-store",
      tier: "hot",
      step: 3,
      label: "history + summary",
      detail: {
        what: "The turn's reads and writes: load summary plus recent turns to build the prompt; create the turn record; append stream chunks to the buffer; finalise the turn.",
        why: "Both directions ride one partition keyed by conversation id, which is what makes the load ~20ms and the appends ordered. The turn record's state field (generating, complete, removed, failed) is the truth every recovery path reads.",
        numbers: [
          { value: "~20ms history load", explain: "Summary row + last ~10 turns from one partition." },
          { value: "~160k buffer appends/s at peak", explain: "One small write per ~50-token chunk per active stream, spread across shards by conversation id." },
        ],
        breaks: {
          failure: "A hot conversation, a shared thread hammered by one enterprise bot, saturates its single partition.",
          handled: "Per-conversation turn rate is capped well below partition limits, because a conversation is by definition serial: turns that would exceed it queue client-side. Sharding within a conversation is deliberately not built.",
        },
      },
    },
    {
      id: "e4",
      from: "chat-svc",
      to: "moderation",
      tier: "data",
      label: "classify in + scan out",
      detail: {
        what: "Two calls per turn: the input classification before routing, and the chunk-scan stream that runs beside the output.",
        why: "Keeping moderation a separate service keeps its models, thresholds and audit trail independently deployable from chat logic, and safety rules change far more often than the turn pipeline does.",
        numbers: [
          { value: "~10ms input verdict", explain: "Sized to sit inside the first-token budget rather than beside it." },
          { value: "verdict within ~1s of offending output", explain: "The chunk cadence bounds how much unsafe text can reach a screen before the cut." },
        ],
        breaks: {
          failure: "The output scan falls behind the stream and verdicts land after the user already read the text.",
          handled: "The gateway holds a ~50-token delivery lag buffer: the user reads slightly behind generation, so a cut verdict removes text the user has not yet seen. The lag is imperceptible at reading speed.",
        },
      },
    },
    {
      id: "e5",
      from: "chat-svc",
      to: "router",
      tier: "hot",
      step: 4,
      label: "prompt, ≤8k tokens",
      detail: {
        what: "The finished prompt with its routing envelope: plan tier, opted model, token count, and the turn's idempotency key.",
        why: "The chat service decides what the model is told; the router decides which model is told it. Splitting those means cost policy changes ship without touching prompt logic, and vice versa.",
        numbers: [{ value: "~1,200 prompt tokens median", explain: "The budgeted size; the router uses the count directly in pool selection since long prompts prefer the large-context pool." }],
        breaks: {
          failure: "A prompt-builder bug emits an over-budget prompt and the per-turn cost quietly doubles fleet-wide.",
          handled: "The router hard-rejects prompts over budget rather than paying for them; the turn fails visibly and the bug is a page, not a bill.",
        },
      },
    },
    {
      id: "e6",
      from: "router",
      to: "inference",
      tier: "hot",
      step: 5,
      label: "to the chosen pool",
      detail: {
        what: "The routed request entering the chosen model pool's queue, carrying the turn id for metering and the stream handle for output.",
        why: "This is the boundary where the product's latency promise meets the fleet's batching reality: the router queues by tier, so a paid turn waits behind paid turns only.",
        numbers: [
          { value: "~100ms queue + dispatch budget", explain: "The slice of the first-token budget spent between router and prefill start under normal load." },
          { value: "~30s queue cap per tier", explain: "Beyond ~30 seconds of queued work the turn is rejected with retry-after rather than adding to a collapsing pool's backlog." },
        ],
        breaks: {
          failure: "Failover during a pool incident doubles traffic onto the surviving pool and takes it down too.",
          handled: "Failover sheds as it moves: brownout drops free-tier turns to the small pool first, and the cap rejects the remainder early. Half-service through an incident beats symmetric collapse.",
        },
      },
    },
    {
      id: "e7",
      from: "inference",
      to: "gateway",
      tier: "hot",
      step: 6,
      label: "token stream, SSE out",
      detail: {
        what: "The generated tokens flowing to the gateway, which relays them down the client's open SSE response while the chat service appends the same chunks to the turn buffer.",
        why: "Streaming is the product: ~600ms to the first word instead of ~8 to 12 seconds to a full answer. The dual consumption, client and buffer, is what makes the stream survivable: either side can drop and the other still has the turn.",
        numbers: [
          { value: "~50 tokens/s per stream", explain: "Generation speed, which the user experiences as the answer typing itself." },
          { value: "~8M tokens/s fleet-wide at peak", explain: "160k concurrent streams x 50 tokens/s: the relay volume the gateway tier carries, a few hundred MB/s of text." },
        ],
        breaks: {
          failure: "A slow client cannot drain its stream and backpressure would stall a GPU batch slot worth more than the client.",
          handled: "The gateway buffers per connection and drops to buffer-and-replay for slow clients: generation always runs at full speed into the turn buffer, and the client catches up from it. GPU time is never hostage to a phone on 2G.",
        },
      },
    },
    {
      id: "e9",
      from: "gateway",
      to: "billing",
      tier: "data",
      label: "quota check",
      detail: {
        what: "The admission read: one per-user row of rolled-up usage against plan ceiling, cached at the gateway for 10 seconds.",
        why: "The only billing question the hot path ever asks is may this user start a turn, and a minute-stale answer is deliberately good enough.",
        numbers: [{ value: "~1ms read, 10s cache", explain: "Effective load on the store is a fraction of turn rate; correctness bound is the rollup minute anyway." }],
        breaks: {
          failure: "Cache plus rollup lag lets a user at 99% of quota fire a burst and land minutes of overage.",
          handled: "Accepted and bounded: overshoot cannot exceed cache TTL plus one rollup interval of turns, and plans price it in. Hard-real-time cutoffs belong to prepaid keys, not chat plans.",
        },
      },
    },
    {
      id: "e10",
      from: "inference",
      to: "metering",
      tier: "data",
      label: "tokens in/out, per turn",
      detail: {
        what: "One usage event per finished or aborted turn: turn id, user, model, exact prompt and completion token counts.",
        why: "Counted where they were generated. The fleet's tokenizer is the billing tokenizer, so the number billed is the number computed, and no other tier can drift from it.",
        numbers: [{ value: "~500M events/day", explain: "One per turn, emitted at finalise or abort, retried until acknowledged." }],
        breaks: {
          failure: "A fleet node dies after streaming but before emitting, and a completed turn goes unbilled.",
          handled: "A reconciler diffs finalised turns in the conversation store against metering events and re-emits the gap; the turn-id key makes the repair idempotent.",
        },
      },
    },
    {
      id: "e11",
      from: "metering",
      to: "billing",
      tier: "data",
      label: "rollup, 1-min windows",
      detail: {
        what: "The aggregation job folding raw events into per-user, per-minute usage rows the gateway reads.",
        why: "The rollup is the single writer to quota state, which is what makes usage numbers auditable: every balance is reproducible from the log.",
        numbers: [{ value: "1-min cadence, ~50GB/day in", explain: "Small enough to reprocess a whole day in minutes when a pricing bug needs a rebuild." }],
        breaks: {
          failure: "A pricing-config error misprices a day of usage for one plan.",
          handled: "Rewind and replay: the log is retained 90 days, rollups are deterministic, and corrected balances ship with an adjustment entry rather than a silent overwrite.",
        },
      },
    },
    {
      id: "e12",
      from: "convo-store",
      to: "summarizer",
      tier: "control",
      label: "threads past 6k tokens",
      detail: {
        what: "A change-feed trigger: conversations whose stored verbatim history crossed the threshold are queued for compaction, and the new summary row is written back.",
        why: "Summarisation must never block a turn, so it rides a feed off the store rather than the turn path. The write-back is versioned: the summary row points at the turn range it replaces.",
        numbers: [{ value: "~2% of conversations/day compact", explain: "Most threads never reach the threshold; the summarizer's small-model cost stays negligible." }],
        breaks: {
          failure: "A turn arrives while its conversation is mid-compaction and the prompt builder sees old summary plus already-folded turns.",
          handled: "The summary swap is atomic on version: the builder reads either the old summary with the old turn range or the new pair, never a mix. Double-covered context for one turn is the worst case, which is redundant, not wrong.",
        },
      },
    },
  ],
  figures: {
    resume: {
      title: "A dropped stream resumes from the turn buffer, not from the model",
      nodes: [
        { id: "phone", label: "Client, reconnecting", sub: "turn 812, saw offset 214", kind: "client", col: 0, row: 0 },
        {
          id: "gw",
          label: "Any gateway node",
          sub: "no memory of turn 812",
          kind: "gateway",
          col: 0,
          row: 1,
          detail: {
            what: "The reconnect lands on any node; nothing about the turn lives in gateway memory.",
            why: "Resume is a read: replay buffered chunks after offset 214, then continue relaying the live stream if generation is still running.",
          },
        },
        {
          id: "buffer",
          label: "Turn buffer",
          sub: "chunks 0..340, still growing",
          kind: "database",
          col: 0,
          row: 2,
          detail: {
            what: "The turn's completion accumulating in the conversation store as it is generated.",
            why: "The buffer is written by the turn's owner regardless of any client connection, so the answer exists even if nobody is watching it arrive.",
          },
        },
        {
          id: "model",
          label: "Generation, unaware",
          sub: "never stopped, never re-ran",
          kind: "service",
          col: 1,
          row: 2,
          detail: {
            what: "The inference request, which ran to completion exactly once whatever the client's connection did.",
            why: "Reconnects and retries attach to the turn by idempotency key; the GPU never hears about them. One generation, one bill.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "phone", to: "gw", tier: "hot", step: 1, label: "resume 812 from 214" },
        { id: "e2", from: "gw", to: "buffer", tier: "hot", step: 2, label: "replay 215..340" },
        { id: "e3", from: "model", to: "buffer", tier: "data", label: "still appending" },
      ],
    },
  },
};
