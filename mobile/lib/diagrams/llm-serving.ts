import type { Diagram } from "./types";

export const LLM_SERVING: Diagram = {
  id: "llm-serving",
  title: "LLM Serving",
  question: "Design an LLM Inference & Serving Platform",
  sourceId: "patterns",
  itemId: 46,
  overview: {
    shape:
      "A serving platform is a memory allocator with a scheduler bolted on top: requests queue outside the GPU, admitted only when the paged KV pool can afford them.",
    forces: [
      {
        constraint: "A lone decode stream achieves under 1% of the machine's peak FLOPs",
        decision: "Decode batches every running sequence into one fused forward pass each step, re-decided every ~14ms",
        lights: ["decode", "scheduler", "e9"],
      },
      {
        constraint: "KV for a 32k-token conversation is ~10.5GB, and output length is unknown at admission time",
        decision: "The Paged KV pool allocates in fixed 16-token blocks, so concurrency is bytes-per-sequence, not a guess",
        lights: ["kv-pool", "e10"],
      },
      {
        constraint: "One free-block count decides admission, and a generic load balancer never sees it",
        decision: "Requests wait in a durable Priority queue, and admission happens inside the Scheduler next to the memory it spends",
        lights: ["queue", "router", "scheduler", "e4", "e5"],
      },
      {
        constraint: "Reserving all of max_tokens per request up front is safe for 1 request and catastrophic at 256",
        decision: "Admission is optimistic, and Preemption evicts and recomputes rather than reserving for the worst case",
        lights: ["preempt", "e15", "e16"],
      },
      {
        constraint: "Weights are 140GB against an 80GB GPU",
        decision: "A replica is forced to be 8 GPUs tensor-parallel inside one NVLink domain, not a scaling choice",
        lights: ["replica-group", "decode"],
      },
    ],
    naive: {
      text: "Treat a GPU like any other stateless compute node: accept a request and run it start to finish on whichever machine is free. A single decode stream re-reads all 17.5GB of per-GPU weights out of HBM for every token it emits. That achieves a fraction of a percent of the hardware's peak throughput. Reserving a full max_tokens worth of KV memory per request up front is also safe but catastrophic. At 1,290 possible concurrent sequences, that reservation alone would exhaust the pool on a handful of long-context requests. The Scheduler instead batches every running sequence into one shared forward pass per step. The Paged KV pool allocates memory lazily in small blocks, rather than reserving the worst case.",
      lights: ["scheduler", "kv-pool", "decode"],
    },
    beats: [
      {
        text: "Inference is two workloads sharing one set of weights. Prefill pushes the whole prompt through the model in one dense pass and runs near the arithmetic roofline. Decode emits one token per sequence per step and re-reads every weight out of HBM each time, so a lone stream achieves a fraction of a percent of the machine. Throughput comes from batching decode, which makes the batch the thing you are actually scheduling.",
        lights: ["prefill", "decode", "e9"],
      },
      {
        text: "What caps the batch is memory, not arithmetic. Every sequence in flight holds key and value tensors for every token of context, about 320KB per token on a 70B model with grouped-query attention. It grows by one token every step. A 1,100-token conversation is ~350MB, a 32k one is ~10.5GB, and concurrency is just a division: pool over bytes per sequence.",
        lights: ["kv-pool"],
      },
      {
        text: "So requests wait in a durable queue and never on a GPU. A per-replica scheduler owns the KV pool and admits from that queue only when free blocks allow, re-deciding batch membership every 14ms rather than every request. Admission has to sit next to the memory it is spending, because a generic load balancer can see request counts but not free blocks.",
        lights: ["queue", "router", "scheduler", "kv-pool", "e4", "e5", "e12"],
      },
      {
        text: "KV lives in fixed 16-token blocks with a per-sequence block table, which is virtual memory for attention. External fragmentation disappears because every block is the same size. Internal waste is bounded at 15 tokens, and a shared system prompt becomes a refcounted block run rather than recomputed prefill. That allocator change alone is worth roughly 7x concurrency.",
        lights: ["kv-pool", "prefix-cache", "e14"],
      },
      {
        text: "Output length is unknown at admission, so admission is optimistic: charge for the prompt's blocks, hold back a reserve so running sequences can grow, and let the pool run hot. Preemption is therefore a routine control path, not an error path. Evict the newest lowest-priority sequence and recompute its prefill on readmission, which is cheaper than swapping KV over PCIe.",
        lights: ["scheduler", "preempt", "e15", "e16"],
      },
      {
        text: "Weights are 140GB against an 80GB GPU, so a replica is 8 GPUs tensor-parallel inside one NVLink domain and parallelism is forced rather than chosen. Scale is replicas, cold start is minutes because 140GB has to be pulled and warmed, and the number the business watches is dollars per million tokens.",
        lights: ["replica-group", "registry", "usage-ledger", "e6", "e7", "e18"],
      },
    ],
    crux: {
      problem:
        "The KV cache is the binding constraint and it is invisible in every FLOP-based capacity model. You must commit memory for a job whose size you only learn when it ends.",
      handled:
        "So admission is optimistic and preemption is the safety valve, evicting a victim and recomputing its prefill rather than reserving for the worst case up front. That allocator has no stable equilibrium under sustained overload. Preempting to make room costs recompute, and the recompute lengthens the step that caused the pressure in the first place.",
    },
    numbers: [
      {
        value: "~320KB of KV per token, ~350MB per 1.1k-token request",
        explain: "The per-token memory cost that turns concurrency into a division problem: pool size over bytes per sequence.",
      },
      {
        value: "452GB pool / 350MB = ~1,290 sequences, latency caps it at ~256",
        explain: "The theoretical concurrency the pool allows against what the actual running batch size is held to, since memory is not the only limit.",
      },
      {
        value: "decode step ~14ms, ~18k output tokens/s per replica",
        explain: "The per-step latency and the resulting aggregate throughput one replica delivers once batching is in effect.",
      },
    ],
  },
  nodes: [
    {
      id: "replica-group",
      label: "Replica = 8 GPUs, tensor-parallel",
      kind: "zone",
      detail: {
        what: "One serving unit: 8 GPUs inside a single NVLink domain, holding one copy of the sharded weights and running prefill and decode for whatever sequences are currently admitted to it.",
        why: "The model does not fit on one GPU, so the replica boundary is set by interconnect, not by choice. Everything inside it shares an all-reduce fast enough to keep a 14ms step, and everything outside it is a separate pool of memory the scheduler cannot see into.",
        numbers: [
          { value: "8 GPUs per replica, TP=8", explain: "The parallelism degree forced by weight size, not chosen for throughput." },
          { value: "140GB of weights sharded to 17.5GB per GPU", explain: "The per-GPU memory footprint once the model is split across the domain." },
        ],
        breaks: {
          failure: "A single GPU fault inside the domain takes down every in-flight sequence on all 8.",
          handled: "Tensor parallelism has no partial-failure mode. KV for every running sequence lives split across the group, and none of it survives one member disappearing.",
        },
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "SSE stream, may disconnect",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "Whoever is calling /v1/completions, usually holding a server-sent-events connection open for the whole generation.",
        why: "It is drawn because it sets two constraints the platform cannot negotiate. One is the prompt-to-output mix that decides the prefill-to-decode fleet ratio. The other is a TCP connection that can vanish silently while the GPU keeps generating.",
        numbers: [
          { value: "~800 prompt + ~300 output tokens typical", explain: "The request shape the fleet's ratio of prefill to decode capacity is sized against." },
          { value: "~2k req/s at peak", explain: "The peak arrival rate the whole platform is provisioned for." },
        ],
        breaks: {
          failure: "A client that opens a stream, takes the first token and disappears leaves a sequence generating to max_tokens.",
          handled: "The gateway turns the TCP close into an abort the scheduler applies at its next step, freeing the blocks within one step interval instead of running to max_tokens.",
        },
      },
    },
    {
      id: "gateway",
      label: "API gateway",
      sub: "authn, SSE, abort propagation",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "Terminates TLS and SSE, authenticates the tenant, debits per-tenant Redis token buckets before enqueue. It also tokenises the prompt and pushes token ids onto the queue.",
        why: "Everything that can be decided without a GPU should be decided here. A request rejected at the edge costs nothing, while a request admitted to a replica costs memory that other streams needed. It also owns the only place a client disconnect is visible. Metering tokens rather than requests matters, since a 500-token prompt and a 100k-token prompt are one request each but 160MB and 32GB of pool respectively.",
        numbers: [
          { value: "tokenisation ~3ms", explain: "Negligible next to the ~14ms scheduler step, so paying it up front costs nothing even for requests the token bucket is about to reject." },
          { value: "429 with Retry-After rather than unbounded queueing", explain: "The shedding behaviour once quota or capacity is exhausted." },
          { value: "a 100k-token prompt is ~32GB of KV; eight fill a 452GB pool", explain: "A concrete illustration of why token-based metering matters far more than request counting." },
        ],
        breaks: {
          failure: "Undetected disconnects. If TCP close is not turned into an abort the scheduler applies on the next step, generation continues.",
          handled: "Blocks stay held and the customer is billed for tokens nobody read. Quota bucket state is also per-region and replicates asynchronously, so a tenant can briefly overspend across regions during a failover. That is accepted, rather than paying for a synchronous check on the hot path.",
        },
        choice: {
          pick: "Envoy at the edge, streaming SSE with disconnect propagated as an abort",
          instead: "A plain HTTP load balancer that buffers the response body.",
          decider:
            "Whether an abandoned stream can be stopped. A buffering proxy hides TCP close from the engine, so an abandoned request generates its full max_tokens, roughly 4s of batch slot and ~350MB of KV per occurrence. At 2k req/s even a low abandonment rate is a permanent slice of the fleet.",
          flips: "A non-streaming, internal-only API where responses are small and every request runs to completion anyway, so there is no disconnect to propagate.",
        },
      },
    },
    {
      id: "queue",
      label: "Priority queue",
      sub: "Kafka, (tenant, tier) partitions",
      kind: "queue",
      col: 1,
      row: 1,
      detail: {
        what: "A durable log of pending requests carrying token ids, sampling params and a deadline, partitioned by tenant and priority tier.",
        why: "This is the edge that carries the whole argument: requests wait here, not on a GPU. Queue depth becomes the load-shedding signal and admission stays a scheduler decision rather than a load-balancer one.",
        numbers: [
          { value: "~1.2k requests queued platform-wide at peak", explain: "The typical backlog depth at peak load." },
          { value: "age-at-dequeue p99 < 250ms interactive", explain: "The freshness target for the interactive priority tier." },
        ],
        breaks: {
          failure: "Backlog growing past the point where dequeued requests have already timed out.",
          handled: "The fleet spends GPU-seconds generating answers nobody is waiting for. Dequeue must be deadline-aware and drop before it spends a cycle.",
        },
        choice: {
          pick: "Durable partitioned log with deadline-aware dequeue, partitioned by (tenant, tier)",
          instead: "An in-memory queue at the gateway, or dispatching straight to a replica.",
          decider:
            "Whether one tenant can monopolise admission. Per-tenant partitions plus fair-share dequeue is what stops a single customer's 500 concurrent generations occupying every one of ~256 slots. Durability matters less than isolation here, but a gateway restart dropping ~1.2k queued requests is a visible outage.",
          flips: "Single-tenant deployments, where there is nobody to be fair to and an in-process queue removes a broker from the hot path.",
        },
      },
    },
    {
      id: "router",
      label: "Router + autoscaler",
      sub: "replica_state, predictive scale",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "Picks which replica a dequeued request is offered to, using free_blocks and queue depth from replica_state, and decides when to add or drain replicas.",
        why: "Routing on request count is wrong here because replicas differ by free memory, not by connection count. Scaling is the harder half: a scale-up decision takes ~3-5 min to produce a token against a demand curve that moves in seconds, so it cannot be reactive.",
        numbers: [
          { value: "~3-5 min cold start", explain: "The time from a scale-up decision to a new replica serving its first token." },
          { value: "2x diurnal swing", explain: "The typical demand curve amplitude this autoscaler has to anticipate." },
          { value: "~15% warm buffer", explain: "The standing headroom kept ready to absorb the gap while a scale-up completes." },
        ],
        breaks: {
          failure: "Routing conversations by hash for prefix-cache residency fights fair-share balancing.",
          handled: "Accepted: fixing it means capping affinity strength or watching per-replica queue skew, at the cost of the prefix-cache locality affinity exists to protect.",
        },
        choice: {
          pick: "Route on free KV blocks with conversation-id affinity, scale predictively off the traffic curve",
          instead: "Least-connections load balancing with reactive autoscaling on GPU utilisation.",
          decider:
            "Cold start against the demand curve. Reactive scaling needs the signal-to-capacity gap to be shorter than the swing, and 3-5 min against a 2x diurnal move is not. Utilisation is also the wrong trigger: nvidia-smi reads 100% on a batch-1 decode achieving 0.2% of peak.",
          flips: "A fleet with weights already resident on idle warm nodes, where scale-up is process start rather than a 140GB pull and reactive scaling becomes viable again.",
        },
      },
    },
    {
      id: "registry",
      label: "Model registry",
      sub: "object store + metadata row",
      kind: "database",
      col: 0,
      row: 2,
      detail: {
        what: "Versioned safetensors shards in object storage plus a metadata row holding arch config, tokenizer hash, eval scorecard and rollout state.",
        why: "Weights are immutable per replica, so a version change is a replica replacement rather than an in-place swap. The registry is what makes that roll safe: it pins the tokenizer to the weights and keeps the previous version resident for instant rollback.",
        numbers: [
          { value: "~140GB per bf16 version", explain: "140GB ÷ ~2GB/s ≈ 70s — most of the 3-5 min cold start is this pull, which is why scale-up must be decided minutes ahead of demand." },
          { value: "12 live versions ≈ 1.7TB", explain: "The steady-state storage footprint of every version kept resident for rollback." },
          { value: "a full fleet roll is ~13TB of egress", explain: "The bandwidth cost of replacing every replica with a new version." },
        ],
        breaks: {
          failure: "A corrupt or partially written shard makes a replica serve fluent garbage with no error.",
          handled: "Checksum on load and a warmup canary with an expected-logprob assertion catch it before the replica joins the routing table.",
        },
        choice: {
          pick: "Object store for shards with a metadata table pinning the tokenizer hash",
          instead: "Baking weights into the container image, or an NFS mount.",
          decider:
            "Pull bandwidth and version count. 140GB at ~2GB/s effective is ~70s of the ~3-5 min cold start, and 12 versions in the image registry is 1.7TB of layers you re-pull on every code change. Separating code from weights makes a code deploy seconds and a weight roll minutes.",
          flips: "Small models where weights are a few GB, at which point baking them in removes a failure mode and the pull is not the bottleneck.",
        },
      },
    },
    {
      id: "scheduler",
      label: "Scheduler",
      sub: "continuous batching, step ≈ 14ms",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "The in-process, per-replica loop that every step evicts finished sequences, preempts if the pool is exhausted, admits from the queue against the free-block budget, and issues one fused forward pass.",
        why: "Batch membership is re-decided every 14ms rather than every request, so a finished sequence frees its slot the step it stops instead of at the end of a cohort. That is what makes utilisation track offered load rather than collapse to the slowest member.",
        numbers: [
          { value: "B ≈ 256 running", explain: "The typical batch size this loop maintains at steady state." },
          { value: "RESERVE = 512 blocks held back", explain: "The standing headroom kept out of admission so running sequences can grow." },
          { value: "admission and block accounting ~0.3ms per step", explain: "The overhead this loop adds on top of the actual forward pass." },
        ],
        breaks: {
          failure: "It is stateful and latency-critical: if the process wedges, GPUs sit idle with a full queue.",
          handled: "GPU utilisation still reads high, so step rate is what is alerted on. A restart is treated as a replica failure, since in-flight KV is unrecoverable.",
        },
        choice: {
          pick: "Continuous batching, membership re-decided every step",
          instead: "Static batching: assemble a fixed cohort, run it to completion, take the next.",
          decider:
            "Occupancy against the ITL swing a live stream absorbs. With output lengths roughly exponential around a mean of 300, the expected maximum of 32 draws is ~1,220 tokens. A static batch retires on a member running four times longer than average, and the mean slot pads ~75% of its life. Continuous batching is worth 2 to 4x.",
          flips: "Offline, length-homogeneous work such as bulk embedding or fixed-schema extraction. There padding loss is small, and a fixed batch shape lets you capture CUDA graphs and delete the scheduler from the hot path.",
        },
      },
    },
    {
      id: "prefill",
      label: "Prefill",
      sub: "compute-bound, 256-token chunks",
      kind: "service",
      col: 2,
      row: 3,
      detail: {
        what: "One dense forward pass over the whole prompt, run as 256-token chunks interleaved into scheduler steps rather than as one long pass.",
        why: "Prefill is the compute-bound half and it runs near the roofline, so it is efficient but monopolising. A single long prompt run to completion stalls every decoding stream on the replica. Chunking trades that request's own TTFT for everyone else's inter-token latency.",
        numbers: [
          { value: "~140 GFLOP/token", explain: "The compute cost per prompt token, which is what makes prefill the compute-bound half." },
          { value: "800 tokens ≈ 112 TFLOP ≈ 31ms at ~45% MFU", explain: "The end-to-end compute cost for a typical prompt at realistic hardware efficiency." },
          { value: "one chunk ~10ms", explain: "The cost of a single 256-token chunk, small enough to interleave into a decode step budget." },
        ],
        breaks: {
          failure: "Head-of-line blocking. A 32k prompt is ~1.3s of compute before the attention n-squared term.",
          handled: "At 32k that term is no longer negligible, and unchunked it freezes 250 streams for over a second, which chunking exists specifically to prevent.",
        },
        choice: {
          pick: "Chunked prefill, 256 tokens per chunk, interleaved with decode on the same replica",
          instead: "Running each prompt as one pass, or disaggregating prefill into its own replica pool.",
          decider:
            "The stall it removes against the TTFT it costs. Chunking turns a 1.3s freeze into a step that grows from ~14ms to ~24ms, at the price of that request reaching its first token in ~3s instead of ~1.3s. Full disaggregation removes the stall entirely but ships ~350MB of KV per request between pools, ~700GB/s at 2k req/s.",
          flips: "When long-context traffic is more than a few percent of the mix. There it earns its own replica pool with a smaller batch target and separate pricing, rather than being smeared across the interactive fleet.",
        },
      },
    },
    {
      id: "decode",
      label: "Decode",
      sub: "TP=8 over NVLink, 1 tok/step",
      kind: "service",
      col: 2,
      row: 2,
      detail: {
        what: "The fused forward pass that produces exactly one token for every running sequence, sharded across 8 GPUs with an all-reduce twice per transformer block.",
        why: "Every step re-reads all 17.5GB of per-GPU weights out of HBM regardless of batch size, so the arithmetic is nearly free and the batch is nearly free throughput. This is why one sequence alone wastes 99% of the machine and why batching is the entire economic argument.",
        numbers: [
          { value: "weights 17.5GB at ~2.3TB/s ≈ 7.6ms", explain: "The dominant cost of a decode step: reading every weight, regardless of batch size." },
          { value: "KV read ~10.2GB/GPU ≈ 4.4ms", explain: "The second-largest cost, which scales with how many sequences are running." },
          { value: "all-reduce ~2ms, step ≈ 14ms", explain: "The synchronisation cost across the tensor-parallel group and the resulting total step time." },
        ],
        breaks: {
          failure: "An all-reduce that hangs deadlocks the whole tensor-parallel group with no error.",
          handled: "A single GPU fault kills all ~256 in-flight generations at once, because KV is unrecoverable once one group member disappears.",
        },
        choice: {
          pick: "Tensor parallelism, TP=8 inside one NVLink domain, one replica per node",
          instead: "Pipeline parallelism across nodes, shipping only boundary activations.",
          decider:
            "Interconnect bandwidth against the per-token budget. TP moves 256 x 8192 x 2B x 2 x 80 ≈ 670MB per decode step. That is ~0.7ms of a 14ms step on NVLink at ~900GB/s but ~13ms on a 400Gb/s fabric, nearly doubling the step and eating the whole 30ms p95 ITL margin.",
          flips: "When the model will not fit in one domain at all. A 400B model in bf16 is ~800GB against 640GB per node, so it is TP=8 inside and PP=2 across, and there is no choice to make.",
        },
      },
    },
    {
      id: "preempt",
      label: "Preemption",
      sub: "newest low-pri, recompute",
      kind: "service",
      col: 3,
      row: 3,
      detail: {
        what: "The safety valve for optimistic admission: when free blocks hit zero mid-step, evict a victim and recompute its prefill when it is readmitted.",
        why: "Output length is unknown at admission, so the scheduler commits memory for a job whose size it learns only when the job ends. Reserving max_tokens is safe and catastrophic, so the pool runs hot and preemption becomes a routine control path rather than an error path.",
        numbers: [
          { value: "recompute ~43ms for 1,100 tokens", explain: "Cheaper than a full swap round trip (2 × ~22ms ≈ 44ms) at this length, and stateless, so it never contends with weight loads on PCIe." },
          { value: "swap ~22ms each way over PCIe", explain: "350MB ÷ ~16GB/s ≈ 22ms per direction — a link already busy with weight loads, which is why recompute wins except on much longer contexts." },
          { value: "target < 1% of steps", explain: "The healthy operating rate this mechanism is tuned to stay under." },
        ],
        breaks: {
          failure: "No stable equilibrium under sustained overload: preempting to make room costs recompute.",
          handled: "The recompute lengthens the step that caused the pressure. Above ~5% of steps the pool is thrashing while every instantaneous gauge reads healthy.",
        },
        choice: {
          pick: "Drop and recompute the prefix on readmission, victim = newest lowest-priority, with aging",
          instead: "Swapping the victim's KV out to host DRAM over PCIe and back.",
          decider:
            "Which resource the eviction contends for. Recompute is ~43ms of compute for a 1,100-token sequence and is stateless. Swap is ~350MB at ~16GB/s, ~22ms each way, on a PCIe link already busy with weight loads. Victim choice matters more than the mechanism: preempting the oldest discards the most accumulated work and produces convoys.",
          flips: "Very long contexts, where the arithmetic inverts. A 32k sequence is ~10.5GB, so swapping is ~656ms each way against ~1.3s to recompute, and swapping wins if the PCIe link is otherwise idle.",
        },
      },
    },
    {
      id: "kv-pool",
      label: "Paged KV pool",
      sub: "~452GB, 16-token blocks",
      kind: "database",
      col: 2,
      row: 1,
      detail: {
        what: "Key and value tensors held in fixed 16-token physical blocks with a per-sequence block table, and an attention kernel that gathers across it.",
        why: "It is virtual memory for attention, and the properties transfer exactly. Allocation becomes lazy and per-block so a sequence holds only what it has generated, external fragmentation disappears because every block is identical in size, and shared prefixes become a refcount.",
        numbers: [
          { value: "320KB/token = 2 x 80 layers x 8 KV heads x 128 dim x 2B", explain: "The derivation of the per-token memory cost from the model's architecture." },
          { value: "~88k blocks of 5.12MB", explain: "The pool's total block count and per-block size." },
          { value: "~1,290 sequences at the 1.1k mix, ~43 at 32k", explain: "The concurrency this pool supports at typical and long-context request sizes." },
        ],
        breaks: {
          failure: "It is the binding constraint and it is invisible in FLOP-based capacity models.",
          handled: "The pool fills long before the arithmetic runs out, and it fills faster as contexts grow: 8k contexts drop concurrency to ~173, 32k to ~43 on identical hardware.",
        },
        choice: {
          pick: "PagedAttention: 16-token blocks with a per-sequence block table",
          instead: "Contiguous per-sequence buffers pre-allocated to max_tokens, which is what the kernel wants.",
          decider:
            "Slots per pool. Contiguous pre-allocation to an 8k ceiling gives 452GB / 2.6GB ≈ 173 slots at every context length. Paged allocation at true length gives ~1,290, roughly 7x from an allocator change. Internal fragmentation is bounded at 15 tokens, ~4.8MB against a ~350MB sequence, under 1.5%.",
          flips: "Any runtime without a paged attention kernel, where variable batch composition means real reallocation rather than a block-table update, and static batching over contiguous buffers is the honest choice.",
        },
      },
    },
    {
      id: "prefix-cache",
      label: "Prefix cache",
      sub: "refcounted blocks, LRU",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "Block runs keyed by a rolling hash of the token prefix at 16-token granularity plus the model version, refcounted and evicted LRU.",
        why: "A shared system prompt is computed once and reused by everyone who starts with it, so the prefill work disappears rather than being repeated. It is the same mechanism as copy-on-write between blocks, which makes parallel sampling and beam search nearly free.",
        numbers: [
          { value: "~600 of 800 prompt tokens shared", explain: "The typical overlap between one request's prompt and the pinned system prompt it shares with others." },
          { value: "~75% hit rate assumed", explain: "The planning assumption this cache's sizing and fleet ratio are built on." },
          { value: "top ~50 prompts pinned ≈ 9.6GB of 452GB", explain: "The pool budget deliberately reserved for the highest-value cached prefixes." },
        ],
        breaks: {
          failure: "Thrash. A workload with many distinct system prompts evicts the pinned ones.",
          handled: "The hit rate collapses, silently doubling the prefill fleet's work with no error anywhere. Hit rate, not occupancy, is what is alerted on.",
        },
        choice: {
          pick: "Cross-tenant sharing, keyed by hash(token prefix) plus model version",
          instead: "Partitioning the cache per tenant and sharing only explicitly registered public prefixes.",
          decider:
            "Fleet cost against a timing oracle. The ~75% hit rate is worth about a third of the fleet, ~280 GPUs of ~500 prefill and roughly $0.18 per million tokens. The exposure is that a hit is ~25ms TTFT against ~70ms cold, which an attacker can measure to confirm a guessed prefix token by token.",
          flips: "Any tenancy where a system prompt is a secret worth stealing, where you partition by tenant, accept a lower hit rate and pay for the larger prefill fleet.",
        },
      },
    },
    {
      id: "usage-ledger",
      label: "Usage ledger + telemetry",
      sub: "columnar OLAP, no prompt text",
      kind: "database",
      col: 0,
      row: 4,
      detail: {
        what: "Per-request prompt and output token counts, cached-prefix tokens, TTFT, ITL histogram and finish reason, partitioned by (tenant, day), feeding billing and metrics.",
        why: "Cost per million tokens is the number the business funds, and it is derived here rather than measured on a GPU. It is also where the prefill-to-decode ratio and the cache hit rate are re-derived weekly, because both are customer behaviour rather than design.",
        numbers: [
          { value: "~2KB metadata per request", explain: "The per-record footprint of this store." },
          { value: "2k req/s ≈ 4MB/s ≈ 350GB/day", explain: "The write throughput and daily volume at peak traffic." },
          { value: "RF=3 ≈ 1TB/day", explain: "The replicated storage cost this store adds per day." },
        ],
        breaks: {
          failure: "Billing on delivered tokens rather than generated ones lets an abandoned stream bill nothing.",
          handled: "That happens while having burned the GPU. Generated is the correct unit, and the gap between the two counters is how undetected disconnects are found.",
        },
        choice: {
          pick: "Columnar OLAP store, metadata only, no prompt or completion content by default",
          instead: "Row-store transactional records, or logging full request and response bodies.",
          decider:
            "Volume and access pattern. This is 2k writes/s of ~2KB, ~350GB/day before replication, read almost exclusively as aggregates over (tenant, day). Storing bodies multiplies it by roughly the token count and turns a metrics store into a data-protection liability.",
          flips: "Debugging a quality regression, where a sampled and consented slice of full prompts is worth keeping in a separate, short-retention store with its own access controls.",
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
      label: "POST /v1/completions",
      detail: {
        what: "The request itself: model id, prompt, max_tokens, temperature, seed and whether the response streams.",
        why: "max_tokens arrives here and is a claim, not a promise, which is the root of the admission problem. It bounds the sequence but tells the scheduler nothing useful about how much memory it will actually consume.",
        numbers: [{ value: "~800 prompt tokens typical", explain: "The typical prompt size for a request arriving on this edge." }],
        breaks: {
          failure: "A default max_tokens set generously is the cheapest way for clients to hold batch slots they never use.",
          handled: "The gateway has to shape it rather than pass it through, since nothing downstream can tell a real bound from a padded one.",
        },
      },
    },
    {
      id: "e3",
      from: "gateway",
      to: "queue",
      tier: "hot",
      step: 2,
      label: "enqueue token ids",
      detail: {
        what: "Tokenised prompt, sampling params and a deadline appended to the tenant's partition.",
        why: "This is the boundary the whole design turns on: past it the request is the scheduler's problem, before it the request is cheap to refuse. Shedding here with a 429 costs nothing; shedding after admission costs the memory already spent.",
        numbers: [{ value: "tokenisation ~3ms", explain: "The cost incurred before a request crosses this boundary." }],
        breaks: {
          failure: "If the gateway queues instead of shedding under overload, the backlog grows past client deadlines.",
          handled: "The fleet then generates answers that will be discarded on arrival, which is why shedding at the edge is preferred over unbounded queueing.",
        },
      },
    },
    {
      id: "e4",
      from: "queue",
      to: "router",
      tier: "hot",
      step: 3,
      label: "dequeue, deadline-aware",
      detail: {
        what: "Pulling the highest-priority request whose deadline has not already passed, fair-shared across tenant partitions.",
        why: "Age at dequeue, not depth, is the actionable signal: a deep queue that drains fast is fine. Dropping an expired request here is the cheapest possible outcome because it has not touched a GPU.",
        numbers: [{ value: "age-at-dequeue p99 < 250ms interactive", explain: "The freshness bound this edge is held to for the interactive tier." }],
        breaks: {
          failure: "Strict priority starves the batch tier indefinitely under sustained interactive load.",
          handled: "Dequeue applies the same aging preemption uses: priority score rises with wait time, so batch-tier requests eventually outrank fresh interactive ones.",
        },
      },
    },
    {
      id: "e5",
      from: "router",
      to: "scheduler",
      tier: "hot",
      step: 4,
      label: "offer to replica",
      detail: {
        what: "Handing a dequeued request to one replica's scheduler, chosen by free blocks and conversation affinity.",
        why: "The router chooses where, the scheduler chooses whether. Splitting it that way is deliberate: a load balancer cannot see free KV blocks, so it would happily route a 32k prompt to a replica with 12MB left. The offer carries replica_state: free blocks, running sequences and queue depth.",
        breaks: {
          failure: "replica_state is sampled, so it is stale by up to a step interval.",
          handled: "The router can offer to a replica that has just filled. The scheduler refusing is the correction, which means offers must be re-queueable.",
        },
      },
    },
    {
      id: "e6",
      from: "router",
      to: "registry",
      tier: "control",
      label: "scale-up: pull version",
      detail: {
        what: "A scale-up or version-roll decision instructing a new node to fetch and load a specific model version.",
        why: "This is where autoscaling stops resembling CPU autoscaling. The gap between deciding and serving is dominated by a 140GB pull and warmup. The decision has to be made minutes before the load arrives, rather than in response to it.",
        numbers: [
          { value: "~140GB at ~2GB/s ≈ 70s", explain: "The pull time for one full weight set at realistic object-store bandwidth." },
          { value: "~3-5 min to first healthy token", explain: "The full cold-start latency once pull, load and warmup are all counted." },
        ],
        breaks: {
          failure: "A version roll is a replica replacement, not an in-place swap.",
          handled: "You must over-provision during the roll, or the drain plus cold start is a capacity hole while the new version comes up.",
        },
      },
    },
    {
      id: "e7",
      from: "registry",
      to: "prefill",
      toSide: "bottom",
      tier: "control",
      label: "load 140GB shards",
      detail: {
        what: "Sharded safetensors pulled into HBM on cold start, checksummed, then warmed with CUDA-graph capture and a canary prompt.",
        why: "Weights are immutable for the life of a replica, which makes this a startup cost rather than a hot-path cost. It is also what makes the whole fleet's elasticity a function of object-store bandwidth.",
        numbers: [
          { value: "17.5GB per GPU after TP=8 sharding", explain: "The per-GPU weight footprint this load places into HBM." },
          { value: "~3-5 min before it joins the routing table", explain: "~70s is the 140GB pull at ~2GB/s; checksum, CUDA-graph capture and canary warmup burn the rest — the full gap the autoscaler predicts ahead of demand." },
        ],
        breaks: {
          failure: "Tokenizer drift. If the tokenizer version does not match the weights after a partial rollout, the replica serves subtly wrong text with no error.",
          handled: "The tokenizer hash is compared against the registry row at load, and a mismatch refuses to start rather than serving silently wrong output.",
        },
      },
    },
    {
      id: "e8",
      from: "scheduler",
      to: "prefill",
      tier: "hot",
      step: 5,
      label: "admit, 256-token chunks",
      detail: {
        what: "An admitted request entering prefill, charged only for the blocks its uncached prompt actually needs.",
        why: "Admission is optimistic by design. It charges for the prompt and nothing for the unknown output, holding back RESERVE blocks so every running sequence can grow by one block on the next step.",
        numbers: [
          { value: "800 tokens / 16 = 50 blocks ≈ 16MB", explain: "The actual block cost this edge charges for a typical prompt." },
          { value: "RESERVE = 512 blocks", explain: "The headroom held back so admission never fully exhausts the pool." },
        ],
        breaks: {
          failure: "Every admission slows every stream already running.",
          handled: "The same edge that raises throughput is the one that degrades an in-flight response's inter-token latency, which is why RESERVE exists to bound how much.",
        },
      },
    },
    {
      id: "e9",
      from: "prefill",
      to: "decode",
      tier: "hot",
      step: 6,
      label: "join running batch",
      detail: {
        what: "The sequence moving from its one-pass prompt phase into the per-step token loop, first token already emitted.",
        why: "This is the seam the whole question turns on: the same weights, the same pool, two completely different performance regimes. Prefill is roofline-bound arithmetic, decode is HBM bandwidth, and no single blended latency SLO describes both.",
        numbers: [
          { value: "TTFT ≈ 25ms on a cache hit, ~70ms cold", explain: "The prefix-cache hit/miss gap is why TTFT and inter-token latency must be separate SLOs — one blended number would hide which regressed." },
          { value: "then ~71 tok/s per stream", explain: "The steady-state per-stream rate once a sequence is in the running decode batch." },
        ],
        breaks: {
          failure: "A single blended latency metric hides which half regressed.",
          handled: "TTFT and inter-token latency have to be separate SLOs, or a queue-wait regression gets debugged as a model problem.",
        },
      },
    },
    {
      id: "e10",
      from: "prefill",
      to: "kv-pool",
      tier: "data",
      label: "allocate 50 blocks",
      offset: 60,
      detail: {
        what: "Writing the prompt's key and value tensors into freshly allocated 16-token blocks and recording them in the sequence's block table.",
        why: "Allocation is lazy and per-block rather than a reservation, so a request that declares max_tokens=8192 and stops after 40 tokens holds ~13MB rather than 2.6GB. That difference is the entire paging win.",
        numbers: [
          { value: "5.12MB per block", explain: "The physical size of one KV block." },
          { value: "~50 blocks for an 800-token prompt", explain: "The typical number of blocks this edge allocates for one request." },
        ],
        breaks: {
          failure: "The block table is an extra indirection on the hot path.",
          handled: "The gather-based attention kernel runs a few percent slower than a contiguous one, the standing tax paid for the 7x concurrency the paging wins.",
        },
      },
    },
    {
      id: "e11",
      from: "decode",
      to: "kv-pool",
      tier: "hot",
      step: 7,
      label: "read 10.2GB KV cache/GPU",
      offset: 40,
      detail: {
        what: "Every step reads the full KV cache for all running sequences and appends one token's worth back, taking a new block every 16 tokens.",
        why: "This is the term that grows with batch size and is why the latency dial exists: ~9ms per step at B=64, ~14ms at 256, ~22ms at 512. Each admitted sequence adds bytes that every other sequence's step has to read.",
        numbers: [
          { value: "~4.4ms of a ~14ms step", explain: "This read's share of the total step time at typical batch size." },
          { value: "machine balance ~300 FLOP/byte, so decode is memory-bound to B ≈ 300", explain: "The hardware ratio that determines the batch size at which decode stops being purely memory-bound." },
        ],
        breaks: {
          failure: "Past batch ≈ 300 the step turns compute-bound and grows roughly linearly.",
          handled: "The scheduler caps running batch at B≈256, below the B≈300 hardware ceiling, so admission throttles before the step turns compute-bound and throughput stalls.",
        },
      },
    },
    {
      id: "e12",
      from: "kv-pool",
      to: "scheduler",
      tier: "control",
      label: "free blocks, RESERVE=512",
      offset: 120,
      detail: {
        what: "The free-block count read back into the admission decision at the top of every step.",
        why: "This single number is where backpressure, preemption and load-shedding are all decided, which is exactly why admission has to be co-located with the allocator rather than delegated to anything upstream.",
        numbers: [{ value: "~17.5k of ~88k blocks allocated at peak", explain: "The typical occupancy this signal reports at peak load." }],
        breaks: {
          failure: "Reading it instantaneously is misleading during a thrash.",
          handled: "The count looks fine immediately after each eviction. The reliable signals are rate-based, preemptions and recomputed tokens per second, and therefore lagging.",
        },
      },
    },
    {
      id: "e13",
      from: "scheduler",
      to: "prefix-cache",
      tier: "control",
      label: "lookup prefix hash",
      detail: {
        what: "Checking whether a leading run of the prompt's blocks already exists, and refcounting them in if so.",
        why: "It turns repeated prefill into an integer increment. A 600-token system prompt sent 40,000 times a day is computed once and held once at ~192MB, rather than recomputed per request.",
        numbers: [
          { value: "~75% hit rate assumed", explain: "The planning assumption behind this lookup's expected payoff." },
          { value: "effective prefill drops 800 to ~350 tokens", explain: "The typical reduction in compute a hit produces." },
        ],
        breaks: {
          failure: "The key must carry the model version, or a rollout serves KV computed by the previous weights.",
          handled: "The output diverges with no error to catch it, which is why the version is folded into the hash itself rather than checked separately.",
        },
      },
    },
    {
      id: "e14",
      from: "prefix-cache",
      to: "kv-pool",
      tier: "control",
      label: "refcounted block runs",
      detail: {
        what: "Cached prefixes are not a separate store: they are blocks in the same pool with a refcount above one.",
        why: "Sharing that way means a hit costs nothing to set up, and copy-on-write falls out for free. N sampling candidates share the prompt's blocks and fork only where they diverge.",
        numbers: [{ value: "top ~50 prompts pinned ≈ 9.6GB of the 452GB pool", explain: "The budget deliberately reserved for the pinned, highest-value prefixes." }],
        breaks: {
          failure: "Pinned prefixes are pool the running batch cannot use.",
          handled: "An over-aggressive pin set trades concurrency for a hit rate that may not materialise, so pinning is bounded rather than unlimited.",
        },
      },
    },
    {
      id: "e15",
      from: "decode",
      to: "preempt",
      tier: "control",
      label: "free blocks == 0",
      detail: {
        what: "The step discovering mid-flight that a running sequence needs a block the pool cannot supply.",
        why: "It exists because admission was optimistic. The scheduler deliberately did not reserve for unknown output length, so the over-commitment has to be resolved here rather than prevented earlier.",
        numbers: [
          { value: "target < 1% of steps", explain: "The healthy rate this trigger is expected to fire at." },
          { value: "above ~5% the pool is thrashing", explain: "The threshold past which this trigger's frequency signals genuine overload rather than normal variance." },
        ],
        breaks: {
          failure: "RESERVE is a tuned constant with no principled derivation.",
          handled: "It is sized against an observed prompt and output mix, and silently becomes wrong the moment a large tenant changes a prompt template.",
        },
      },
    },
    {
      id: "e16",
      from: "preempt",
      to: "scheduler",
      toSide: "top",
      tier: "control",
      label: "readmit, recompute 43ms",
      detail: {
        what: "The evicted sequence going back to the head of the queue and re-running its prefill when blocks free up.",
        why: "Recompute is chosen over swapping because it contends only for compute, not for a busy PCIe link. It is also stateless, so a failure during it costs nothing extra.",
        numbers: [
          { value: "~43ms for 1,100 tokens", explain: "The cost this edge pays to redo a victim's prefill." },
          { value: "promoted and made ineligible as a victim after two preemptions", explain: "The fairness rule that prevents the same sequence from being repeatedly evicted." },
        ],
        breaks: {
          failure: "This is the self-feeding loop: the recompute comes out of the same budget that would have retired the sequences still running.",
          handled: "Under genuine over-subscription preemption makes the pressure worse, which is the fundamental instability the design accepts rather than hides.",
        },
      },
    },
    {
      id: "e17",
      from: "decode",
      to: "client",
      tier: "hot",
      step: 8,
      label: "SSE tokens, ~71 tok/s",
      offset: 140,
      detail: {
        what: "Sampled tokens detokenised and pushed back down the open SSE connection, one per stream per step.",
        why: "Streaming is what makes a 14ms step tolerable. The user reads at well under 33 tokens/s, so per-token delivery hides a total generation time of several seconds behind a first token in tens of milliseconds.",
        numbers: [
          { value: "ITL p95 SLO < 30ms", explain: "The per-token latency target this edge is held to." },
          { value: "~18k output tokens/s per replica across the batch", explain: "The aggregate throughput this edge delivers once batching is in effect." },
        ],
        breaks: {
          failure: "No individual request has a latency contract on this path.",
          handled: "Its ITL moves with strangers' arrivals, 9ms at B=64 and 22ms at 512, so one response can degrade 2.4x between its first token and its last.",
        },
      },
    },
    {
      id: "e18",
      from: "decode",
      to: "usage-ledger",
      tier: "control",
      label: "token counts, TTFT, ITL",
      offset: 180,
      detail: {
        what: "Per-request accounting emitted when a sequence finishes: tokens in and out, cached prefix tokens, TTFT, ITL histogram and finish reason.",
        why: "Goodput per GPU and cost per million tokens can only be computed from here, and they are the only honest efficiency metrics. GPU utilisation reads 100% on a batch-1 decode achieving 0.2% of peak.",
        numbers: [
          { value: "target ~$0.48 per million blended tokens", explain: "The cost target this ledger's aggregates are measured against." },
          { value: "output tokens cost ~2.7x prompt tokens", explain: "The relative cost weighting between the two token types this ledger tracks." },
        ],
        breaks: {
          failure: "Emitting only on clean finish loses the aborted and preempted requests.",
          handled: "Those are exactly the ones whose cost you most need to attribute, so this edge also fires on abort and eviction, not only success.",
        },
      },
    },
  ],
};
