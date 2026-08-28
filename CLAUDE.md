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

- **Data model** (`mobile/lib/diagrams/types.ts`, specs in `mobile/lib/diagrams/<id>.ts`):
  `Diagram` = `question` + `overview` + `nodes` + `edges`. Every node and every edge
  carries a `detail` (`what` / `why` / `numbers` / `breaks`), and components with a
  real technology decision also carry a `choice` (`pick` / `instead` / `decider` /
  `flips`) in the same shape as the written `Key decisions` sections, so the diagram
  and the prose agree. Deciders must contain the number or property that settles it.
- **`kind` is a claim about what a thing IS**, not a colour picker. Nine box kinds —
  `service`, `process`, `queue`, `database`, `cache`, `blob`, `gateway`, `client`,
  `external` — and two frames, `serviceGroup` and `zone`. Each kind drives a hue, a
  motif drawn inside the box, and an uppercase type tag in the top-right corner.
- **`process` may only appear inside a `serviceGroup`.** A `serviceGroup` is one
  deployable service containing several stages; a `process` is one of those stages.
  This exists because four stages of one request path were being drawn as four peer
  services, which asserts a deployment that is not real. `check-diagrams.ts` enforces
  the containment. Do not demote things the prose says scale or fail independently —
  the frame is a modelling tool, not a tidying reflex.
- **Every motif is drawn INSIDE the bounding rectangle** (cylinder rims, queue bars,
  gateway chevrons). Never change a box's outline to a real cylinder or hexagon:
  `spaceColumns()`, `placeLabels()` and `check-diagrams.ts` all measure rectangles,
  and a non-rectangular outline silently breaks all three.
- **Renderer**: `mobile/components/ArchDiagram.web.tsx`. `ArchDiagram.tsx` is a
  native stub — the shipping app is a WebView shell over the web build, so the
  `.web.tsx` is what renders on every surface. Same split as `SvgDiagram`.
- **Everything is clickable**: boxes, a frame (via its label chip or header strip;
  the body stays click-through so it cannot swallow clicks meant for nodes inside
  it), and every arrow.
- **Arrow clicks are resolved by distance, not by hit areas.** `BaseEdge` is given
  `interactionWidth={0}` on purpose and `onPaneClick` runs `nearestEdgeId()`, which
  samples every rendered path and takes the closest within 16px. Do not "fix" this
  by restoring a fat invisible hit path: measured on the notification system, 26px
  interaction paths left 4 of 18 edges unselectable *anywhere along their length*,
  because stacked transparent strokes resolve by paint order rather than by which
  line the pointer was actually nearest, and an edge passing under a box is
  unreachable regardless of how wide its hit area is.
- **Arrowheads are 20 FLOW units, not screen pixels.** `fitView` scales the whole
  canvas and these diagrams land at 0.35-0.65 zoom, so the 9px head that looked
  right in a full-scale mockup rendered at 3-6px and read as no arrowhead at all.
  Size arrowheads for the zoom the app actually uses, not for the mockup.
- **Routing keeps 16 units of CLEARANCE around every box, and the checker uses 12.**
  A corridor that merely misses a box's interior still runs along its border, which
  reads as a line glued to the side of every box in a column. An earlier checker
  *inset* boxes instead of inflating them and called that clean.
- **Edges are routed by `assignLanes()` + `corridorPath()`, not by
  `getSmoothStepPath`.** That function places its perpendicular run at the
  midpoint between the two nodes and **ignores its own `offset` argument** for a
  normal left-to-right pair, so every edge crossing the same gap turns at the
  same coordinate and they are drawn on top of each other. Measured before the
  router existed: 27 pairs of coincident edges across the first seven diagrams,
  one pair running together for 448px; afterwards, 1.
  Two separate corrections, and both are needed:
  - `srcShift` / `dstShift` fan edges that share a node face, because otherwise
    they start or end at literally the same point.
  - `corridor` gives each edge its own lane for the perpendicular run.
  The lane search is **scored, not first-fit**: first-fit has no answer when
  every candidate is bad, so two edges both fall back to the natural midpoint
  and stack — the exact failure the function exists to prevent. Burial scores
  worse than crowding, because a buried line is invisible as well as
  unclickable.
- **A frame must be made click-through in CSS, not in its component.** Setting
  `pointerEvents: "none"` on a frame component's own `<div>` does nothing useful:
  React Flow wraps every custom node in its own `.react-flow__node` element and
  that wrapper keeps pointer events, so a frame silently swallows every click
  aimed at a box or an arrow inside it. `LABEL_LAYER_CSS` therefore carries
  `.react-flow__node-zone, .react-flow__node-serviceGroup { pointer-events: none
  !important; }`, with the title strip re-enabling them so the frame stays
  selectable. **The `!important` is load-bearing** — React Flow ships
  `.react-flow__node { pointer-events: all }` at the same specificity and its
  stylesheet wins on order.
  This one bug accounted for nearly all of "I can't click the arrow, there is a
  component above it": across the first seven diagrams it left **41 of 126 arrows
  unclickable**, dropping to 5 once the wrapper stopped intercepting. None of
  those 41 were actually drawn underneath anything.
- **Wiring a diagram to a question**: set `sourceId` + `itemId` on the spec, then
  add an `#### Interactive diagram` section to that question linking to
  `/diagram/<id>`. `ItemView` intercepts markdown links starting with `/` and
  routes them through expo-router; without that, `react-native-markdown-display`
  hands them to `Linking.openURL`, which on web is a full page reload.
- **Copy-all includes the diagram.** `CopyButton` appends
  `diagramToMarkdown(diagram)` when `getDiagramForItem(sourceId, itemId)` matches.
  The markdown section itself is only a link, so without this the copy would carry
  a URL instead of the explanations. Update `diagramToMarkdown` if you add fields
  to `DiagramNodeDetail`, or they will silently not be copied.

### Diagram layout and spacing

Edge labels render in React Flow's SVG layer, which sits **below** the node
layer. An oversized label does not push anything aside, it silently disappears
under the next box, so spacing is a correctness concern rather than taste.

- `ArchDiagram.web.tsx` runs `spaceColumns()` over every diagram before render.
  It clusters nodes into columns and rows and enforces `MIN_GUTTER` (190px) and
  `MIN_ROW_GAP` (46px), **keeping authored spacing wherever it is already
  wider**. Do not change these to fixed spacing: forcing a fixed gutter
  over-spreads multi-column diagrams until fitView shrinks the text to nothing.
  Group zones are repositioned to keep framing the same members.
- **Keep the whole diagram roughly the shape of the viewport (~4:3).** `fitView`
  scales to whichever axis binds, so a wide strip shrinks the text while leaving
  vertical space empty. google-maps at 1840x864 rendered at **0.34 scale** —
  unreadable at a glance — while diagrams of similar size but squarer proportions
  sat at 0.5-0.6. If a layout has run to five columns and three rows, fold the
  rightmost columns down into more row bands rather than widening further.
- Because spacing is corrected at render time, specs only need a sane relative
  grid: left column `x: 40`, further columns to the right, vertical steps of
  ~110, widths 240-300, and no overlapping boxes. Boxes are ~84px tall now that
  every one carries a type-tag row, so rows need ~110px of vertical step.
- **Edge labels must be <= 28 characters.** Longer ones collide even at the
  minimum gutter. `check-diagrams.ts` fails. Put the detail in the edge's `detail`,
  which is what clicking the arrow shows, not in the label.
- Edge labels are rendered through `EdgeLabelRenderer` **and** the label layer
  is lifted with `LABEL_LAYER_CSS` (`z-index: 6`). Both are required. React Flow
  emits `.react-flow__edgelabel-renderer` *before* `.react-flow__nodes` in the
  DOM and leaves both at `z-index: auto`, so using the label renderer alone
  changes nothing: paint order still puts labels underneath every node. Spacing
  cannot fix this case either, because the collision is with a node the edge
  routes *across* rather than with the gap the label sits in.
- **A label may only move a short way from its own edge.** `placeLabels()` searches
  outward for a free slot, and the search used to run 22 steps of 11 units — so a
  label could be relocated 242 units away and end up floating in empty space with
  no arrow near it. The search is capped at 6 steps and its cost function now
  charges 4 per unit of distance from the line. A label touching its own arrow
  beats a label in a tidy void.
- Label positions are resolved centrally by `placeLabels()`, not per edge. An
  edge cannot deconflict alone because it cannot see its neighbours, and there
  are three constraints at once: a label must not cover a component box, must
  not overlap another label, and must stay inside the node bounds that `fitView`
  frames or the viewport crops it. `placeLabels` computes each label rectangle,
  then searches outward from the natural midpoint scoring candidates by overlap
  area, taking the least-bad slot rather than giving up. Measured across all 56
  diagrams this took label-on-node from 25 to ~1, label-on-label from 72 to ~2
  and clipped labels from 16 to ~2.
- The out-of-bounds penalty is a strong preference, NOT absolute. Making it
  absolute forces labels back onto component boxes, which is worse: 65
  label-on-node collisions in testing. `fitView` padding is set to 0.4 to cover
  the modest remaining overhang.
- Node geometry constants are measured, not guessed: a box with a sub-label
  renders ~65px tall, a label ~19px, and label width is ~6.3px per character.
  `nodeH()` and `LABEL_CHAR_W` encode this. Guessing 76px here caused the dodge
  to mis-fire.
- Careful with automated collision checks. Geometric overlap no longer implies
  hidden, and `document.elementFromPoint` is useless here because the label divs
  are `pointer-events: none`, so it reports every label as covered. The reliable
  signals are the computed `z-index` of the label layer and looking at a
  screenshot. Any rectangle-based check must also exclude
  `.react-flow__node-zone`, since labels legitimately sit inside zone bounds.

### The diagram gate: `scripts/check-diagrams.ts`

`bunx tsx scripts/check-diagrams.ts [id ...]` — run it after touching any spec.
CLAUDE.md referred to a `check-spec.ts` for a long time; **it never existed**, which
is why 45 of the 56 diagrams were found routing an edge across a box the first time
a real checker ran. Errors fail (exit 1), warnings do not:

- two boxes overlapping;
- an edge whose orthogonal route crosses a box that is not its own endpoint — the
  line, its label and its arrowhead are all drawn and all hidden there, and it
  cannot be clicked there either;
- an edge label over 28 characters;
- a `process` that is not geometrically inside a `serviceGroup`;
- a frame that clips a box it overlaps;
- an edge naming a node that does not exist, or a duplicate node id.

The route check approximates `getSmoothStepPath` as an L (out along the dominant
axis, then across). Fix failures by moving boxes apart or by setting `fromSide` /
`toSide` so the edge leaves and enters faces that are actually clear.

`check-diagrams.ts` is now **exact**: the pure layout maths lives in
`mobile/lib/diagrams/layout.ts` (`spaceColumns`, `assignLanes`, `corridorPath`,
`placeLabels`, `nodeH`, `anchor`) with no React or DOM, and both the renderer and
the checker import it. Keep it that way. Every time the two were allowed to drift
the gate lied — twice in one session.

The browser checker remains useful for what the spec cannot express (rendered
text metrics, actual paint), but it is no longer the only source of truth.

**A route model that only approximates will give false confidence.**
web-crawler passed the static check while arrows were still rendering across boxes,
because the real curve and its lane offset put the corners somewhere else. So there
is a second, slower checker that measures what is actually on screen:

```
bash scripts/build-web.sh && bunx serve -s mobile/dist -l 8099 &
NODE_PATH=<a dir with playwright> node scripts/check-diagrams-rendered.js <id> ...
```

It samples every rendered path and reports the percentage of each edge's length
that falls inside a rendered box, plus any edge label sitting on a box. Use the
static check as the fast gate and this one before shipping. Note it must exclude
`.react-flow__node-zone` **and** `.react-flow__node-serviceGroup` from "boxes" —
labels and edges legitimately sit inside frames.

### The "Interactive diagram" section is optional

`scripts/validate_sd.py` splits `SECTIONS` (canonical order, used for ordering and
for the manifest check) from `OPTIONAL_SECTIONS`. Only `REQUIRED_SECTIONS` must be
present in every question, which is what lets this section roll out one question at
a time. It sits **after `Summary`**, and the physical order in `patterns.md` must
match the canonical order or the validator fails with S5. Adding it to a question
means: write the section, and add it to `sectionOrder` in **both** manifests.

## Standing user preferences

- **Merge policy**: drilly only — once a change is approved, merge straight to `main` without re-asking. The user has explicitly opted into "always merge to main" for this repo.
- **No Co-Authored-By trailers** on commits (global user instruction).
- **Be terse / no fluff**: the user has caveman-mode preferences. Drop pleasantries; lead with the answer.

## Deploy gotchas

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
