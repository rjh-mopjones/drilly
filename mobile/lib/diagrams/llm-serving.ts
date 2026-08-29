import type { Diagram } from "./types";

export const LLM_SERVING: Diagram = {
  id: "llm-serving",
  title: "LLM Serving",
  question: "Design an LLM Inference & Serving Platform",
  sourceId: "patterns",
  itemId: 46,
  overview: {
    shape:
      "A serving platform is a memory allocator with a scheduler bolted on top: requests queue outside the GPU and are admitted only when the paged KV pool can afford the bytes they will hold.",
    beats: [
      "Inference is two workloads sharing one set of weights. Prefill pushes the whole prompt through the model in one dense pass and runs near the arithmetic roofline. Decode emits one token per sequence per step and re-reads every weight out of HBM each time, so a lone stream achieves a fraction of a percent of the machine. Throughput comes from batching decode, which makes the batch the thing you are actually scheduling.",
      "What caps the batch is memory, not arithmetic. Every sequence in flight holds key and value tensors for every token of context, about 320KB per token on a 70B model with grouped-query attention, and it grows by one token every step. A 1,100-token conversation is ~350MB, a 32k one is ~10.5GB, and concurrency is just a division: pool over bytes per sequence.",
      "So requests wait in a durable queue and never on a GPU. A per-replica scheduler owns the KV pool and admits from that queue only when free blocks allow, re-deciding batch membership every 14ms rather than every request. Admission has to sit next to the memory it is spending, because a generic load balancer can see request counts but not free blocks.",
      "KV lives in fixed 16-token blocks with a per-sequence block table, which is virtual memory for attention. External fragmentation disappears because every block is the same size, internal waste is bounded at 15 tokens, and a shared system prompt becomes a refcounted block run rather than recomputed prefill. That allocator change alone is worth roughly 7x concurrency.",
      "Output length is unknown at admission, so admission is optimistic: charge for the prompt's blocks, hold back a RESERVE so running sequences can grow, and let the pool run hot. Preemption is therefore a routine control path, not an error path. Evict the newest lowest-priority sequence and recompute its prefill on readmission, which is cheaper than swapping KV over PCIe.",
      "Weights are 140GB against an 80GB GPU, so a replica is 8 GPUs tensor-parallel inside one NVLink domain and parallelism is forced rather than chosen. Scale is replicas, cold start is minutes because 140GB has to be pulled and warmed, and the number the business watches is dollars per million tokens.",
    ],
    crux:
      "The KV cache is the binding constraint and it is invisible in every FLOP-based capacity model. You must commit memory for a job whose size you only learn when it ends, so admission is optimistic and preemption is the safety valve, and that allocator has no stable equilibrium under sustained overload.",
    numbers: [
      "~320KB of KV per token, ~350MB per 1.1k-token request",
      "452GB pool / 350MB = ~1,290 sequences, latency caps it at ~256",
      "decode step ~14ms, ~18k output tokens/s per replica",
    ],
  },
  nodes: [
    {
      id: "replica-group",
      label: "Replica = 8 GPUs, tensor-parallel",
      kind: "zone",
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
        why: "It is drawn because it sets two constraints the platform cannot negotiate: the prompt-to-output mix that decides the prefill-to-decode fleet ratio, and a TCP connection that can vanish silently while the GPU keeps generating.",
        numbers: ["~800 prompt + ~300 output tokens typical", "~2k req/s at peak"],
        breaks:
          "A client that opens a stream, takes the first token and disappears leaves a sequence generating to max_tokens for ~4s while holding ~350MB of pool. That is a denial-of-wallet vector, not just waste.",
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
        what: "Terminates TLS and SSE, authenticates the tenant, debits per-tenant Redis token buckets (quota:{tenant}:{minute}, metered on tokens/min as well as requests/min) before enqueue, tokenises the prompt and pushes token ids onto the queue.",
        why: "Everything that can be decided without a GPU should be decided here, because a request rejected at the edge costs nothing while a request admitted to a replica costs memory that other streams needed. It also owns the only place a client disconnect is visible. Metering tokens rather than requests matters because a 500-token prompt and a 100k-token prompt are one request each but 160MB and 32GB of pool respectively, a 200x spread a request counter meters nothing about.",
        numbers: [
          "tokenisation ~3ms",
          "429 with Retry-After rather than unbounded queueing",
          "a 100k-token prompt is ~32GB of KV; eight fill a 452GB pool",
        ],
        breaks:
          "Undetected disconnects. If TCP close is not turned into an abort the scheduler applies on the next step, generation continues, blocks stay held and the customer is billed for tokens nobody read. Quota bucket state is also per-region and replicates asynchronously, so a tenant can briefly overspend across regions during a failover; that is accepted, the alternative is a synchronous check on the hot path.",
        choice: {
          pick: "Envoy at the edge, streaming SSE with disconnect propagated as an abort",
          instead: "A plain HTTP load balancer that buffers the response body.",
          decider:
            "Whether an abandoned stream can be stopped. A buffering proxy hides TCP close from the engine, so an abandoned request generates its full max_tokens, roughly 4s of batch slot and ~350MB of KV per occurrence. At 2k req/s even a low abandonment rate is a permanent slice of the fleet.",
          flips:
            "A non-streaming, internal-only API where responses are small and every request runs to completion anyway, so there is no disconnect to propagate.",
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
        what: "A durable log of pending requests carrying token ids, sampling params and a deadline, partitioned by tenant and priority tier (see #16).",
        why: "This is the arrow that carries the whole argument: requests wait here, not on a GPU. Queue depth becomes the load-shedding signal and admission stays a scheduler decision rather than a load-balancer one.",
        numbers: ["~1.2k requests queued platform-wide at peak", "age-at-dequeue p99 < 250ms interactive"],
        breaks:
          "Backlog growing past the point where dequeued requests have already timed out, so the fleet spends GPU-seconds generating answers nobody is waiting for. Dequeue must be deadline-aware and drop before it spends a cycle.",
        choice: {
          pick: "Durable partitioned log with deadline-aware dequeue, partitioned by (tenant, tier)",
          instead: "An in-memory queue at the gateway, or dispatching straight to a replica.",
          decider:
            "Whether one tenant can monopolise admission. Per-tenant partitions plus fair-share dequeue is what stops a single customer's 500 concurrent generations occupying every one of ~256 slots. Durability matters less than isolation here, but a gateway restart dropping ~1.2k queued requests is a visible outage.",
          flips:
            "Single-tenant deployments, where there is nobody to be fair to and an in-process queue removes a broker from the hot path.",
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
        numbers: ["~3-5 min cold start", "2x diurnal swing", "~15% warm buffer"],
        breaks:
          "Routing conversations by hash for prefix-cache residency fights fair-share balancing, so a chatty tenant concentrates on one replica and that replica's queue grows while others idle.",
        choice: {
          pick: "Route on free KV blocks with conversation-id affinity, scale predictively off the traffic curve",
          instead: "Least-connections load balancing with reactive autoscaling on GPU utilisation.",
          decider:
            "Cold start against the demand curve. Reactive scaling needs the signal-to-capacity gap to be shorter than the swing, and 3-5 min against a 2x diurnal move is not. Utilisation is also the wrong trigger: nvidia-smi reads 100% on a batch-1 decode achieving 0.2% of peak.",
          flips:
            "A fleet with weights already resident on idle warm nodes, where scale-up is process start rather than a 140GB pull and reactive scaling becomes viable again.",
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
        numbers: ["~140GB per bf16 version", "12 live versions ≈ 1.7TB", "a full fleet roll is ~13TB of egress"],
        breaks:
          "A corrupt or partially written shard makes a replica serve fluent garbage with no error. Checksum on load and a warmup canary with an expected-logprob assertion before it joins the routing table.",
        choice: {
          pick: "Object store for shards with a metadata table pinning the tokenizer hash",
          instead: "Baking weights into the container image, or an NFS mount.",
          decider:
            "Pull bandwidth and version count. 140GB at ~2GB/s effective is ~70s of the ~3-5 min cold start, and 12 versions in the image registry is 1.7TB of layers you re-pull on every code change. Separating code from weights makes a code deploy seconds and a weight roll minutes.",
          flips:
            "Small models where weights are a few GB, at which point baking them in removes a failure mode and the pull is not the bottleneck.",
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
        numbers: ["B ≈ 256 running", "RESERVE = 512 blocks held back", "admission and block accounting ~0.3ms per step"],
        breaks:
          "It is stateful and latency-critical: if the process wedges, GPUs sit idle with a full queue while GPU utilisation still reads high. Alert on step rate, and treat a restart as a replica failure because in-flight KV is unrecoverable.",
        choice: {
          pick: "Continuous batching, membership re-decided every step",
          instead: "Static batching: assemble a fixed cohort, run it to completion, take the next.",
          decider:
            "Occupancy against the ITL swing a live stream absorbs. With output lengths roughly exponential around a mean of 300, the expected maximum of 32 draws is ~1,220 tokens, so a static batch retires on a member running four times longer than average and the mean slot pads ~75% of its life. Continuous batching is worth 2 to 4x.",
          flips:
            "Offline, length-homogeneous work such as bulk embedding or fixed-schema extraction, where padding loss is small and a fixed batch shape lets you capture CUDA graphs and delete the scheduler from the hot path.",
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
        why: "Prefill is the compute-bound half and it runs near the roofline, so it is efficient but monopolising: a single long prompt run to completion stalls every decoding stream on the replica. Chunking trades that request's own TTFT for everyone else's inter-token latency.",
        numbers: ["~140 GFLOP/token", "800 tokens ≈ 112 TFLOP ≈ 31ms at ~45% MFU", "one chunk ~10ms"],
        breaks:
          "Head-of-line blocking. A 32k prompt is ~1.3s of compute before the attention n-squared term, which at 32k is no longer negligible, and unchunked it freezes 250 streams for over a second.",
        choice: {
          pick: "Chunked prefill, 256 tokens per chunk, interleaved with decode on the same replica",
          instead: "Running each prompt as one pass, or disaggregating prefill into its own replica pool.",
          decider:
            "The stall it removes against the TTFT it costs. Chunking turns a 1.3s freeze into a step that grows from ~14ms to ~24ms, at the price of that request reaching its first token in ~3s instead of ~1.3s. Full disaggregation removes the stall entirely but ships ~350MB of KV per request between pools, ~700GB/s at 2k req/s.",
          flips:
            "When long-context traffic is more than a few percent of the mix, where it earns its own replica pool with a smaller batch target and separate pricing rather than being smeared across the interactive fleet.",
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
        numbers: ["weights 17.5GB at ~2.3TB/s ≈ 7.6ms", "KV read ~10.2GB/GPU ≈ 4.4ms", "all-reduce ~2ms, step ≈ 14ms"],
        breaks:
          "An all-reduce that hangs deadlocks the whole tensor-parallel group with no error, and a single GPU fault kills all ~256 in-flight generations at once because KV is unrecoverable.",
        choice: {
          pick: "Tensor parallelism, TP=8 inside one NVLink domain, one replica per node",
          instead: "Pipeline parallelism across nodes, shipping only boundary activations.",
          decider:
            "Interconnect bandwidth against the per-token budget. TP moves 256 x 8192 x 2B x 2 x 80 ≈ 670MB per decode step, which is ~0.7ms of a 14ms step on NVLink at ~900GB/s but ~13ms on a 400Gb/s fabric, nearly doubling the step and eating the whole 30ms p95 ITL margin.",
          flips:
            "When the model will not fit in one domain at all. A 400B model in bf16 is ~800GB against 640GB per node, so it is TP=8 inside and PP=2 across, and there is no choice to make.",
        },
      },
    },
    {
      id: "preempt",
      label: "Preemption",
      sub: "newest low-pri, recompute",
      kind: "service",
      col: 2,
      row: 4,
      detail: {
        what: "The safety valve for optimistic admission: when free blocks hit zero mid-step, evict a victim and recompute its prefill when it is readmitted.",
        why: "Output length is unknown at admission, so the scheduler commits memory for a job whose size it learns only when the job ends. Reserving max_tokens is safe and catastrophic, so the pool runs hot and preemption becomes a routine control path rather than an error path.",
        numbers: ["recompute ~43ms for 1,100 tokens", "swap ~22ms each way over PCIe", "target < 1% of steps"],
        breaks:
          "No stable equilibrium under sustained overload: preempting to make room costs recompute, and the recompute lengthens the step that caused the pressure. Above ~5% of steps the pool is thrashing while every instantaneous gauge reads healthy.",
        choice: {
          pick: "Drop and recompute the prefix on readmission, victim = newest lowest-priority, with aging",
          instead: "Swapping the victim's KV out to host DRAM over PCIe and back.",
          decider:
            "Which resource the eviction contends for. Recompute is ~43ms of compute for a 1,100-token sequence and is stateless; swap is ~350MB at ~16GB/s, ~22ms each way, on a PCIe link already carrying weight loads. Victim choice matters more than the mechanism: preempting the oldest discards the most accumulated work and produces convoys.",
          flips:
            "Very long contexts, where the arithmetic inverts. A 32k sequence is ~10.5GB, so swapping is ~656ms each way against ~1.3s to recompute, and swapping wins if the PCIe link is otherwise idle.",
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
        numbers: ["320KB/token = 2 x 80 layers x 8 KV heads x 128 dim x 2B", "~88k blocks of 5.12MB", "~1,290 sequences at the 1.1k mix, ~43 at 32k"],
        breaks:
          "It is the binding constraint and it is invisible in FLOP-based capacity models. The pool fills long before the arithmetic runs out, and it fills faster as contexts grow: 8k contexts drop concurrency to ~173, 32k to ~43 on identical hardware.",
        choice: {
          pick: "PagedAttention: 16-token blocks with a per-sequence block table",
          instead: "Contiguous per-sequence buffers pre-allocated to max_tokens, which is what the kernel wants.",
          decider:
            "Slots per pool. Contiguous pre-allocation to an 8k ceiling gives 452GB / 2.6GB ≈ 173 slots at every context length; paged allocation at true length gives ~1,290, roughly 7x from an allocator change. Internal fragmentation is bounded at 15 tokens, ~4.8MB against a ~350MB sequence, under 1.5%.",
          flips:
            "Any runtime without a paged attention kernel, where variable batch composition means real reallocation rather than a block-table update, and static batching over contiguous buffers is the honest choice.",
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
        numbers: ["~600 of 800 prompt tokens shared", "~75% hit rate assumed", "top ~50 prompts pinned ≈ 9.6GB of 452GB"],
        breaks:
          "Thrash. A workload with many distinct system prompts evicts the pinned ones and the hit rate collapses, silently doubling the prefill fleet's work with no error anywhere. Alert on hit rate, not on occupancy.",
        choice: {
          pick: "Cross-tenant sharing, keyed by hash(token prefix) plus model version",
          instead: "Partitioning the cache per tenant and sharing only explicitly registered public prefixes.",
          decider:
            "Fleet cost against a timing oracle. The ~75% hit rate is worth about a third of the fleet, ~280 GPUs of ~500 prefill and roughly $0.18 per million tokens. The exposure is that a hit is ~25ms TTFT against ~70ms cold, which an attacker can measure to confirm a guessed prefix token by token.",
          flips:
            "Any tenancy where a system prompt is a secret worth stealing, where you partition by tenant, accept a lower hit rate and pay for the larger prefill fleet.",
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
        what: "Per-request prompt and output token counts, cached-prefix tokens, TTFT, ITL histogram and finish reason, partitioned by (tenant, day), feeding billing and metrics (see #17).",
        why: "Cost per million tokens is the number the business funds, and it is derived here rather than measured on a GPU. It is also where the prefill-to-decode ratio and the cache hit rate are re-derived weekly, because both are customer behaviour rather than design.",
        numbers: ["~2KB metadata per request", "2k req/s ≈ 4MB/s ≈ 350GB/day", "RF=3 ≈ 1TB/day"],
        breaks:
          "Billing on delivered tokens rather than generated ones lets an abandoned stream bill nothing while having burned the GPU. Generated is the correct unit, and the gap between the two counters is how you detect undetected disconnects.",
        choice: {
          pick: "Columnar OLAP store, metadata only, no prompt or completion content by default",
          instead: "Row-store transactional records, or logging full request and response bodies.",
          decider:
            "Volume and access pattern. This is 2k writes/s of ~2KB, ~350GB/day before replication, read almost exclusively as aggregates over (tenant, day). Storing bodies multiplies it by roughly the token count and turns a metrics store into a data-protection liability.",
          flips:
            "Debugging a quality regression, where a sampled and consented slice of full prompts is worth keeping in a separate, short-retention store with its own access controls.",
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
      label: "POST /v1/completions",
      detail: {
        what: "The request itself: model id, prompt, max_tokens, temperature, seed and whether the response streams.",
        why: "max_tokens arrives here and is a claim, not a promise, which is the root of the admission problem: it bounds the sequence but tells the scheduler nothing useful about how much memory it will actually consume.",
        numbers: ["~800 prompt tokens typical"],
        breaks:
          "A default max_tokens set generously is the cheapest way for clients to hold batch slots they never use, so the gateway has to shape it rather than pass it through.",
      },
    },
    {
      id: "e3",
      from: "gateway",
      to: "queue",
      tier: "hot",
      label: "enqueue token ids",
      detail: {
        what: "Tokenised prompt, sampling params and a deadline appended to the tenant's partition.",
        why: "This is the boundary the whole design turns on: past it the request is the scheduler's problem, before it the request is cheap to refuse. Shedding here with a 429 costs nothing; shedding after admission costs the memory already spent.",
        numbers: ["tokenisation ~3ms"],
        breaks:
          "If the gateway queues instead of shedding under overload, the backlog grows past client deadlines and the fleet generates answers that will be discarded on arrival.",
      },
    },
    {
      id: "e4",
      from: "queue",
      to: "router",
      tier: "hot",
      label: "dequeue, deadline-aware",
      detail: {
        what: "Pulling the highest-priority request whose deadline has not already passed, fair-shared across tenant partitions.",
        why: "Age at dequeue, not depth, is the actionable signal: a deep queue that drains fast is fine. Dropping an expired request here is the cheapest possible outcome because it has not touched a GPU.",
        numbers: ["age-at-dequeue p99 < 250ms interactive"],
        breaks:
          "Strict priority starves the batch tier indefinitely under sustained interactive load, so the dequeue needs aging just as preemption does.",
      },
    },
    {
      id: "e5",
      from: "router",
      to: "scheduler",
      tier: "hot",
      label: "offer to replica",
      detail: {
        what: "Handing a dequeued request to one replica's scheduler, chosen by free blocks and conversation affinity.",
        why: "The router chooses where, the scheduler chooses whether. Splitting it that way is deliberate: a load balancer cannot see free KV blocks, so it would happily route a 32k prompt to a replica with 12MB left.",
        numbers: ["replica_state carries free_blocks, running_seqs, queue_depth"],
        breaks:
          "replica_state is sampled, so it is stale by up to a step interval and the router can offer to a replica that has just filled. The scheduler refusing is the correction, which means offers must be re-queueable.",
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
        why: "This is where autoscaling stops resembling CPU autoscaling. The gap between deciding and serving is dominated by a 140GB pull and warmup, so the decision has to be made minutes before the load arrives rather than in response to it.",
        numbers: ["~140GB at ~2GB/s ≈ 70s", "~3-5 min to first healthy token"],
        breaks:
          "A version roll is a replica replacement, not an in-place swap, so you must over-provision during the roll or the drain plus cold start is a capacity hole.",
      },
    },
    {
      id: "e7",
      from: "registry",
      to: "prefill",
      tier: "control",
      label: "load 140GB shards",
      detail: {
        what: "Sharded safetensors pulled into HBM on cold start, checksummed, then warmed with CUDA-graph capture and a canary prompt.",
        why: "Weights are immutable for the life of a replica, which is what makes this a startup cost rather than a hot-path cost, and what makes the whole fleet's elasticity a function of object-store bandwidth.",
        numbers: ["17.5GB per GPU after TP=8 sharding", "~3-5 min before it joins the routing table"],
        breaks:
          "Tokenizer drift. If the tokenizer version does not match the weights after a partial rollout, the replica serves subtly wrong text with no error, so the hash is compared against the registry row at load and a mismatch refuses to start.",
      },
    },
    {
      id: "e8",
      from: "scheduler",
      to: "prefill",
      tier: "hot",
      label: "admit, 256-token chunks",
      detail: {
        what: "An admitted request entering prefill, charged only for the blocks its uncached prompt actually needs.",
        why: "Admission is optimistic by design: it charges for the prompt and nothing for the unknown output, holding back RESERVE blocks so every running sequence can grow by one block on the next step.",
        numbers: ["800 tokens / 16 = 50 blocks ≈ 16MB", "RESERVE = 512 blocks"],
        breaks:
          "Every admission slows every stream already running, so the same edge that raises throughput is the one that degrades an in-flight response's inter-token latency.",
      },
    },
    {
      id: "e9",
      from: "prefill",
      to: "decode",
      tier: "hot",
      label: "join running batch",
      detail: {
        what: "The sequence moving from its one-pass prompt phase into the per-step token loop, first token already emitted.",
        why: "This is the seam the whole question turns on: the same weights, the same pool, two completely different performance regimes. Prefill is roofline-bound arithmetic, decode is HBM bandwidth, and no single blended latency SLO describes both.",
        numbers: ["TTFT ≈ 25ms on a cache hit, ~70ms cold", "then ~71 tok/s per stream"],
        breaks:
          "A single blended latency metric hides which half regressed. TTFT and inter-token latency have to be separate SLOs or a queue-wait regression gets debugged as a model problem.",
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
        numbers: ["5.12MB per block", "~50 blocks for an 800-token prompt"],
        breaks:
          "The block table is an extra indirection on the hot path and the gather-based attention kernel runs a few percent slower than a contiguous one. That is the standing tax for the 7x concurrency.",
      },
    },
    {
      id: "e11",
      from: "decode",
      to: "kv-pool",
      tier: "hot",
      label: "read 10.2GB KV/GPU",
      offset: 40,
      detail: {
        what: "Every step reads the full KV cache for all running sequences and appends one token's worth back, taking a new block every 16 tokens.",
        why: "This is the term that grows with batch size and is why the latency dial exists: ~9ms per step at B=64, ~14ms at 256, ~22ms at 512. Each admitted sequence adds bytes that every other sequence's step has to read.",
        numbers: ["~4.4ms of a ~14ms step", "machine balance ~300 FLOP/byte, so decode is memory-bound to B ≈ 300"],
        breaks:
          "Past batch ≈ 300 the step turns compute-bound and grows roughly linearly, so 'just batch harder' stops buying throughput and starts buying only latency.",
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
        numbers: ["~17.5k of ~88k blocks allocated at peak"],
        breaks:
          "Reading it instantaneously is misleading during a thrash, because the count looks fine immediately after each eviction. The reliable signals are rate-based, preemptions per thousand steps and recomputed tokens per second, and therefore lagging.",
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
        numbers: ["~75% hit rate assumed", "effective prefill drops 800 to ~350 tokens"],
        breaks:
          "The key must carry the model version, or a rollout serves KV computed by the previous weights and the output diverges with no error to catch it.",
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
        why: "Sharing that way means a hit costs nothing to set up and copy-on-write falls out for free, so n sampling candidates share the prompt's blocks and fork only where they diverge.",
        numbers: ["top ~50 prompts pinned ≈ 9.6GB of the 452GB pool"],
        breaks:
          "Pinned prefixes are pool the running batch cannot use, so an over-aggressive pin set trades concurrency for a hit rate that may not materialise.",
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
        numbers: ["target < 1% of steps", "above ~5% the pool is thrashing"],
        breaks:
          "RESERVE is a tuned constant with no principled derivation. It is sized against an observed prompt and output mix and silently becomes wrong the moment a large tenant changes a prompt template.",
      },
    },
    {
      id: "e16",
      from: "preempt",
      to: "scheduler",
      tier: "control",
      label: "readmit, recompute 43ms",
      detail: {
        what: "The evicted sequence going back to the head of the queue and re-running its prefill when blocks free up.",
        why: "Recompute is chosen over swapping because it contends only for compute, not for a PCIe link already carrying weight loads, and it is stateless so a failure during it costs nothing extra.",
        numbers: ["~43ms for 1,100 tokens", "promoted and made ineligible as a victim after two preemptions"],
        breaks:
          "This is the self-feeding loop: the recompute comes out of the same budget that would have retired the sequences still running, so under genuine over-subscription preemption makes the pressure worse.",
      },
    },
    {
      id: "e17",
      from: "decode",
      to: "client",
      tier: "hot",
      label: "SSE tokens, ~71 tok/s",
      offset: 140,
      detail: {
        what: "Sampled tokens detokenised and pushed back down the open SSE connection, one per stream per step.",
        why: "Streaming is what makes a 14ms step tolerable: the user reads at well under 33 tokens/s, so per-token delivery hides a total generation time of several seconds behind a first token in tens of milliseconds.",
        numbers: ["ITL p95 SLO < 30ms", "~18k output tokens/s per replica across the batch"],
        breaks:
          "No individual request has a latency contract on this path. Its ITL moves with strangers' arrivals, 9ms at B=64 and 22ms at 512, so one response can degrade 2.4x between its first token and its last.",
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
        numbers: ["target ~$0.48 per million blended tokens", "output tokens cost ~2.7x prompt tokens"],
        breaks:
          "Emitting only on clean finish loses the aborted and preempted requests, which are exactly the ones whose cost you most need to attribute.",
      },
    },
  ],
};
