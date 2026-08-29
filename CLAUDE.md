# Claude session notes — DRILLY

Project-specific guidance for Claude Code. The README is the human-facing doc; this file captures conventions and gotchas Claude would otherwise re-discover the hard way.

## Stack

- **Single codebase via Expo Web**: `mobile/` is Expo (React Native + react-native-web). The web build is `expo export --platform web` outputting `mobile/dist/`. Vercel serves `mobile/dist/`. Don't add a separate `web/` Vite app — that was removed; the `web/public/` directory is now just **content assets** (markdown + manifest), not an app.
- **Workspaces**: Bun monorepo, `mobile/`, `packages/parser/`, root scripts.
- **Deploy**: push to `main` → Vercel auto-deploys. Project domains `drilly-delta-brown.vercel.app` (share URL) and `drilly-rjh-mopjones-projects.vercel.app` (mobile `REMOTE_BASE` in `mobile/lib/content.ts`) both auto-promote.

## Content model

Every primer is **one markdown file** at `web/public/<name>-interview-primer.md`. Headings drive the reader:

- `## Topic` → reader item (sidebar entry, swipeable)
- `### Question` → collapsible card inside that topic

Manifest at `web/public/manifest.json` + mirror at `mobile/assets/content/manifest.json` declares each source. Build script `scripts/build-web.sh` mirrors `web/public/*.md` + `manifest.json` into `mobile/dist/` for Vercel to serve at the deploy root.

### Summary section — required for every topic

Every `## Topic` must open with a `### Summary` card (~700-900 words, 6 subsections in bold). Reference: `web/public/java-interview-primer.md` → `## Core Java` → `### Summary`. See the **Content authoring** section in `README.md` for the full structure and rules.

**Hard rules when adding content**:
- Use `**bold**` for subsections inside a Summary, **never** `###` — `###` is reserved for the question cards and creates parser splits.
- Match Core Java's depth (~930 words) and tone (senior engineer briefing, opinionated, concrete examples — not a glossary).
- If the primer ships in the native bundle (Java, Kotlin, NeetCode, Patterns), `cp web/public/<file>.md mobile/assets/content/<file>.md` after editing. Other primers are remote-only.

## Interactive diagrams

Whole-solution architecture diagrams for System Design Questions, rendered with
React Flow at `/diagram/<id>`. **Diagrams are data, not drawings** — a new one is
a spec file in `mobile/lib/diagrams/`, never hand-authored SVG.

### The four rules (the gate enforces them)

The old rules optimised collisions and produced 56 unreadable diagrams that all
"passed". These optimise what a reader sees. `bunx tsx scripts/check-diagrams.ts`
fails on any of the first four.

1. **Readable or it fails.** The design canvas is 1140×760 (a 1440 window minus
   the sidebar). The laid-out diagram must fit at **zoom ≥ 0.8**. With 220×60
   boxes on a 350×150 pitch that means **at most 4 columns and 5 rows**.
2. **Overview on the canvas, detail in the panel.** **≤ 12 visible boxes.** A
   `serviceGroup` draws as ONE box by default (`N STAGES` tag) and its processes
   become a pipeline list in the panel. Set `expanded: true` only when the
   pipeline IS the subject (the rate limiter's gateway stages). Attribute boxes
   (a store's replicas, an in-process cache, a DLQ) are folded into their
   owner's `sub`/`detail`, not drawn.
3. **Three edge tiers, one of them loud.** `tier: "hot"` (≤ 8 per diagram; bold,
   accent, always labelled), `"data"` (thin; label on hover / selection),
   `"control"` (thin dashed; same). The old `animated`/`dashed` flags still map
   to hot/control if `tier` is missing, but write `tier`.
4. **Zero crossings, nothing over a box.** Long detours are fine; two lines
   crossing is not, and a line under a box is invisible and unclickable. The
   router does the work; the author steers.

### Adding a diagram (the checklist that produced the current 56)

1. Copy the closest finished spec (`web-crawler.ts` for a pipeline with a loop,
   `netflix.ts` for request/data/control bands, `rate-limiter.ts` for an
   expanded gateway pipeline, `notification-system.ts` for per-channel lanes and
   a frame-sourced edge). Register it in `index.ts`.
2. Decide what is on the canvas BEFORE placing anything: ≤ 12 boxes. Stages of
   one deployable go in a `serviceGroup` (collapsed by default). Attributes of
   a box (its replicas, its in-process cache, its DLQ, its sampled archive)
   go into that box's `sub`/`detail`, not into boxes of their own. A box that
   is really a path ("reject path") is an edge.
3. Sketch bands: entry at the top-left, request path flowing right/down,
   stores right/bottom, control plane in its own row or column. Boxes that
   talk sit in adjacent cells; a hot edge should be straight or one elbow.
   ≤ 4 columns × 5 rows.
4. Tier every edge: ≤ 8 `hot` (the request path the reader must see), then
   `data`, then `control`. Write `tier`, not `animated`/`dashed`.
5. Run the gate. If it names a crossing: move cells first (most crossings are
   two diagonals across the same 2×2 of cells — put the endpoints in one row or
   column), then `fromSide`/`toSide`, then a frame-sourced edge for identical
   edges from every member of a frame.
6. Some graphs cannot be drawn crossing-free on a grid however you place them:
   two antiparallel edges between the same pair with a third edge passing
   between them, or K₃,₂ (three workers each hitting the same two stores).
   Fix those with content, never by accepting the crossing: fold the reply into
   the request edge's detail (the fence check's "0 rows" is the stale write's
   response), fold the box that is an alternative rather than a step (optimistic
   CAS is "you don't need the lock"), or merge identical edges into one from
   the frame. Move the folded facts into the survivor's `detail`.
7. Render the PNG and look at it. The gate cannot see ugliness — a hot edge
   that wraps three sides of the canvas passes but reads badly; move cells.
8. Rebuild layouts (`bunx tsx scripts/build-diagram-layouts.ts`, which
   `build-web.sh` runs) so `layouts.json` is fresh; the gate warns if stale.

### The text (the gate lints it too)

The text is what a reader gets when they tap a box, an arrow, or Overview. Its
job is to make the reader **understand this solution** — never to coach the
interview; the user rejected "things to say" outright. `rate-limiter.ts` is the
finished pattern. `bunx tsx scripts/check-diagrams.ts <id>` fails on the errors
below and warns on the rest; a diagram ships with 0 of either.

- **Beats light the picture.** `overview.beats` are `{ text, lights: [ids] }`:
  each names boxes by their *labels* and lists the node and edge ids it is
  about; tapping it lights them and dims the rest. Stages hidden in a collapsed
  group light the group. A beat that lights nothing warns. Where the file has
  stage latencies, one beat sums the budget against the SLO.
- **No cross-references.** Never `#12`, `Q7`, "question 3", "the prose", "the
  write-up", "pseudocode", "other diagrams" — the panel reader has none of
  them. Say the idea in a clause instead. Error.
- **No interview coaching, no narration of the drawing.** "interview",
  "candidate", "out loud", "drawn as", "in the diagram", "the picture", "time
  budget" are errors. A "deliberately not built" beat is fine when it explains a
  boundary of the system.
- **Fields do their job.** `numbers` = figures only (digit or number word);
  `breaks` = a failure the box owns ("X happens, and it looks like Y");
  `choice` on every real box (not client / external / process / zone) with a
  `decider` that carries the number that settles it and a `flips` that is a
  real condition; every frame has a `detail` saying what the frame claims.
- **Jargon stays, explained in place.** `mobile/lib/diagrams/glossary.ts` maps
  term → one line; `Glossed` underlines every match in panel text and a tap
  shows the definition inline. Any ALL-CAPS token not in the glossary warns:
  add it or rewrite. Labels and subs must not *depend* on jargon.
- Numbers reconcile within a file; derive, don't assert. `shape` is the
  design's one idea, `crux` ≤ 3 sentences with the actionable one first.
- Copy-all (`diagramToMarkdown`) prints the question, nests frames, prints edge
  `choice` and the beats with the labels they light — extend it when adding a
  field or the field silently does not copy.

### How a spec is written

- Nodes declare a **grid cell**: `col`, `row` (0-based), and `parent` for
  anything inside a frame. No pixels. Frames (`zone`, `serviceGroup`) have no
  cell of their own except a collapsed `serviceGroup`, which uses `col`/`row`
  for the single box it draws; expanded frames are sized from their members.
- Two boxes cannot share a cell. Processes hidden inside a collapsed group can
  share cells with anything; they are not drawn.
- `fromSide` / `toSide` on an edge are the author's **routing instrument**: worth
  1500 units to the router (a long detour), but never a crossing (3000), so a
  hint that would force a crossing is ignored rather than obeyed. Clear the old
  hints when you re-lay a spec; they were tuned for a different router.
- **Frame-sourced edges**: `from: "<frameId>"` means "from every member". Three
  identical attempt-log edges from three workers are one edge from their lane
  frame; it is also the only way some K₃,₂ patterns draw without a crossing.
- Node labels ≤ 24 chars, subs ≤ 32 chars (the box ellipsises beyond that; the
  gate warns). Edge labels ≤ 28 chars (error).
- Every node and edge keeps its `detail` (`what` / `why` / `numbers` / `breaks`,
  plus `choice` for a real technology decision); see "The text" above for what
  each field must contain.

### Tools

- `bunx tsx scripts/check-diagrams.ts [--summary] [id ...]` — the gate: zoom,
  boxes, hot count, crossings (with the pairs named), box hits, label lengths,
  and the text lint (`textLint()` in the same file).
- `bunx tsx scripts/diagram-skeleton.ts <id>` — the picture as a table: what
  is actually on the canvas, which stages are hidden in a collapsed group, and
  every edge with its endpoints. Reconcile text against this, not the source.
- `bunx tsx scripts/render-diagram.ts <outDir> <id ...>` then
  `NODE_PATH=<dir with playwright> node scripts/render-diagram-png.js <outDir> <id ...>`
  — the computed layout as an SVG/PNG, without building the app. Look at it;
  the gate cannot see ugliness, only rule breaks.
- `scripts/snap-diagrams-to-grid.ts` — one-off pixel→cell migration; keep for
  reference, do not re-run on a migrated spec.
- `scripts/check-diagrams-rendered.js` — browser-side truth for what the
  static check cannot see (rendered text metrics, actual paint).

### How it works (read before touching `layout.ts`)

`mobile/lib/diagrams/layout.ts` is pure (no React, no DOM) and is used by BOTH
the renderer (`mobile/components/ArchDiagram.web.tsx`) and the gate. Keep it
that way: every time the two were allowed to drift, the gate lied.
`layoutDiagram()` runs four steps — collapse groups, place cells, route, place
hot labels — and returns diagnostics (zoom, crossings, box hits) that ARE the
gate's numbers.

The router builds an orthogonal lane grid (gutter lanes between column
clusters, row lanes between row clusters, four margin lanes on every side, and
perpendicular port stubs on each box face) and runs a shortest-path search per
edge with bends charged, overlap and touching forbidden, and a crossing costed
at 3000 units (so a 3000-unit detour still wins). Edges are routed shortest
span first (they have the fewest options), then negotiated for several passes,
then polished pairwise, across a few restart orders, within a time budget.
Hard-won facts:

- **Stamp whole segments, not interior points.** A straight port-to-port edge
  has no interior points after simplification; stamping only those left every
  straight edge invisible to the router and other edges crossed it for free.
- **A collapsed `serviceGroup` is a box** to the router (obstacle, port rules),
  not a frame. Treating it as a frame let edges run along its border.
- **Side faces need three port slots** (±14 on a 60-tall box). With one slot,
  any second edge on a side has to wrap round the outside, which is what the
  ugly detours were.
- Port stub lines beside a box are perpendicular-only (`noH`/`noV`); routes
  never run along a box at 16 px.
- **Both hint bonuses must be applied.** The `toSide` bonus was computed and
  dropped for a while, so arrival faces did nothing and the search went in
  circles on the lock diagram. The end bonus is negative, so Dijkstra only
  stops once nothing cheaper than the best goal can remain.
- Hot labels sit on their run, or one label-height off it, or a full row-gap
  off it when the run is a short gutter; they keep 12 units from any box. The
  browser checker flags labels within 10 px of a box, and it was right.
- **Layouts are precomputed** into `mobile/lib/diagrams/layouts.json` (hash of
  the geometry-relevant fields; the renderer recomputes if stale). The search
  can take a second on a laptop and several on a phone WebView; the app only
  draws.
- The renderer frames `layout.bounds` with `fitBounds`, not `fitView`: routes
  that detour through the margins fall outside the boxes' bounds and were
  clipped on phones. On narrow screens the zoom chrome and the hint are hidden
  — pinch and tap are enough.
- `ArchDiagram.tsx` is a native stub; the shipping app is a WebView over the
  web build, so the `.web.tsx` renders everywhere.
- Arrow clicks resolve by distance (`nearestEdgeId`), not hit areas; frames are
  click-through via `LABEL_LAYER_CSS` (the `!important` is load-bearing).

### Wiring a diagram to a question

Set `sourceId` + `itemId` on the spec, add an `#### Interactive diagram`
section to that question linking to `/diagram/<id>` (`ItemView` routes `/`
links through expo-router), and add the section to `sectionOrder` in both
manifests. `scripts/validate_sd.py` treats the section as optional.

## Standing user preferences

- **Merge policy**: drilly only — once a change is approved, merge straight to `main` without re-asking. The user has explicitly opted into "always merge to main" for this repo.
- **No Co-Authored-By trailers** on commits (global user instruction).
- **Be terse / no fluff**: the user has caveman-mode preferences. Drop pleasantries; lead with the answer.

## Deploy gotchas

- `web/public/service-worker.js` has a `__SHELL_ASSETS__` placeholder that `scripts/build-web.sh` replaces with the exported bundle's hashed JS/CSS paths. Only the `mobile/dist/` copy is real; the SW's install is atomic on those, so a `CACHE_VERSION` bump is safe **only** through a full build — never hand-edit the dist copy.
- App icons are generated: edit `scripts/build-app-icons.sh`, run it, then `cd mobile && bunx expo prebuild --clean --platform android`. `mobile/android/` is gitignored, so the PNGs in `mobile/assets/` are what ships.
- `drilly-delta-brown.vercel.app` is a **project domain**, not a manual alias. It auto-promotes with each prod deploy. **Never** `vercel alias set <deployment> drilly-delta-brown.vercel.app` — that freezes it to a specific deploy. Use `vercel domains add` only.
- The legacy `interview-prep-delta-brown.vercel.app` may auto-regenerate because the project's original name was `interview-prep`. If it reappears, `vercel alias rm` it.
- The Expo dev server (`bunx expo start --web`) **does not serve** `web/public/*.md` — it returns the SPA shell for any non-bundle path, so primers parse as zero items ("No items" in the sidebar). For local content testing, run `bash scripts/build-web.sh` then `bunx serve -s mobile/dist -l 8081`.

## Reader UX rules

- Reveal-on-tap section cards. `Space` reveals next, `Esc` collapses all (web only).
- Reader back arrow goes to `/source/<id>`, deterministic — not history-based.
- Desktop web (≥ 900px width) renders the persistent left sidebar (`mobile/components/DesktopSidebar.tsx`); narrow web + native render the stack with its own back-arrow chrome.
- Per-item revealed state persists via `AsyncStorage` (`revealed:<sourceId>:<itemId>`). The `autoRevealSummary` setting (default on) only seeds the **initial** state for never-opened items — per-item toggles always win after first visit.

## Memory files

User-level memory for this repo lives in the Claude Code user-memory directory for this project. Key entries:
- `drilly-merge-policy.md` — "merge approved branches straight to main"
- `drilly-vercel-deploy.md` — project IDs, alias-vs-domain trap, prod URLs

Update those when you discover something new and operational. Don't duplicate code-discoverable facts there.

## Privacy hygiene

This is a public repository. Do not commit:

- Real names. In code examples, use generic placeholders (`alice`, `bob`, `user1`, `Acme Corp`) — not the maintainer's name or any real person.
- Personal email addresses. Git commits use the GitHub noreply email (`<id>+<username>@users.noreply.github.com`) so commit metadata doesn't leak a personal inbox.
- Absolute paths that identify the maintainer's machine (e.g. home directory, personal vault names). Use env vars (`VAULT_PATH`, `$HOME/notes`) instead.
- API keys, tokens, .env contents. Should never be committed; if one slips, rotate immediately and rewrite history.
- References to the maintainer's employer, current projects outside this repo, or any other identifying context.

If you spot leaked PII while editing, redact it in the same commit and surface it to the user — don't ship the leak forward. If it's in committed history, use `git filter-repo` to rewrite and force-push (see the 2026-05-24 scrub commit for the pattern).

## What NOT to touch without asking

- `packages/parser/src/parser.ts` — content shape is contract; changes propagate through every primer and break the reader. Adjust manifest config first.
- `mobile/lib/content.ts:REMOTE_BASE` — hardcoded to the Vercel project domain; only change if the project URL truly changes.
- `vercel.json` rewrites — SPA fallback. Breaking these breaks deep-links like `/source/java`.
- `mobile/metro.config.js` zustand resolver — forces zustand (a React Flow dependency) onto its CJS build. Its ESM build uses `import.meta.env`, and Metro bundles web as a classic script, so `import.meta` is a hard syntax error that kills the **entire** bundle at parse time and renders a blank page. The route still returns HTTP 200 throughout, so this is invisible unless you actually render the page.
