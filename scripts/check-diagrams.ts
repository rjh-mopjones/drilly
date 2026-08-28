/**
 * Readability gate for the architecture diagram specs.
 *
 * The previous gate measured collisions and passed 56 of 56 while the diagrams
 * were unreadable. This one measures what a reader sees, using the SAME
 * layoutDiagram() the renderer draws with, so the numbers here are the picture:
 *
 *  - zoom          fitView scale on the design canvas; below 0.8 the text is
 *                  too small to read at a glance             (error)
 *  - boxes         visible boxes after collapsing; more than 12 is a wiring
 *                  diagram, not an overview                  (error)
 *  - hot           hot-path edges; more than 8 and nothing is emphasised (error)
 *  - crossings     two lines crossing; a long way round always beats it (error)
 *  - box hits      a line running under or along a box it does not touch (error)
 *  - label length  over 28 chars collides even in a wide gutter (error)
 *  - process       a stage outside any serviceGroup is a false deployment claim (error)
 *  - unrouted      an edge the router could not place at all (error)
 *  - text items    boxes×2 + labels shown; over 40 is busy      (warning)
 *  - legacy        spec still on pixel x/y rather than col/row  (warning)
 *
 * Run: bunx tsx scripts/check-diagrams.ts [--summary] [id ...]
 * Exit 1 on any error.
 */
declare const process: { argv: string[]; exit(code: number): never };

import { DIAGRAMS } from "../mobile/lib/diagrams";
import { isFrame, type Diagram } from "../mobile/lib/diagrams/types";
import {
  layoutDiagram,
  parentOf,
  tierOf,
  MAX_BOXES,
  MAX_HOT,
  MAX_LABEL,
  MAX_NODE_LABEL,
  MAX_NODE_SUB,
  MIN_ZOOM,
} from "../mobile/lib/diagrams/layout";

type Report = { errors: string[]; warnings: string[]; line: string };

function check(authored: Diagram): Report {
  const errors: string[] = [];
  const warnings: string[] = [];

  const seen = new Set<string>();
  for (const n of authored.nodes) {
    if (seen.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
    seen.add(n.id);
  }
  for (const e of authored.edges) {
    if (!seen.has(e.from)) errors.push(`edge ${e.id}: no node "${e.from}"`);
    if (!seen.has(e.to)) errors.push(`edge ${e.id}: no node "${e.to}"`);
    if (e.label && e.label.length > MAX_LABEL)
      errors.push(`edge ${e.id} label ${e.label.length} chars (max ${MAX_LABEL}): "${e.label}"`);
    if (!e.detail) warnings.push(`edge ${e.id} has no detail; a click on it shows nothing`);
  }
  for (const n of authored.nodes) {
    if (n.kind === "process") {
      const p = parentOf(n, authored);
      const home = p && authored.nodes.find((f) => f.id === p && f.kind === "serviceGroup");
      if (!home) errors.push(`process "${n.label}" is not inside any serviceGroup`);
    }
    if (!isFrame(n.kind) && !n.detail) warnings.push(`node "${n.label}" has no detail`);
    if (!isFrame(n.kind) || n.kind === "serviceGroup") {
      if (n.label.length > MAX_NODE_LABEL)
        warnings.push(`"${n.label}" is ${n.label.length} chars; over ${MAX_NODE_LABEL} it is cut off with an ellipsis`);
      if (n.sub && n.sub.length > MAX_NODE_SUB)
        warnings.push(`sub of "${n.label}" is ${n.sub.length} chars; over ${MAX_NODE_SUB} it is cut off: "${n.sub}"`);
    }
  }
  if (errors.some((m) => m.startsWith("edge") && m.includes("no node"))) {
    return { errors, warnings, line: "" };
  }

  const L = layoutDiagram(authored);
  const boxes = L.diagram.nodes.filter((n) => !isFrame(n.kind) || L.collapsed.has(n.id));
  const hot = L.diagram.edges.filter((e) => tierOf(e) === "hot");
  const routed = Object.keys(L.routes).length;
  const textItems = boxes.length * 2 + Object.keys(L.labels).length;

  if (L.onGrid) {
    const cells = new Map<string, string>();
    for (const n of boxes) {
      const key = `${n.col},${n.row}`;
      const other = cells.get(key);
      if (other) errors.push(`"${n.label}" and "${other}" share cell (${key})`);
      cells.set(key, n.label);
    }
  } else {
    warnings.push("legacy pixel layout: give every box a col/row (scripts/snap-diagrams-to-grid.ts)");
  }
  if (L.zoom < MIN_ZOOM)
    errors.push(`zoom ${L.zoom.toFixed(2)} < ${MIN_ZOOM}: ${Math.round(L.bounds.w)}×${Math.round(L.bounds.h)} units is too big to read`);
  if (boxes.length > MAX_BOXES) errors.push(`${boxes.length} visible boxes (max ${MAX_BOXES}): collapse a group or fold attributes into panels`);
  if (hot.length > MAX_HOT) errors.push(`${hot.length} hot edges (max ${MAX_HOT})`);
  if (L.crossings > 0) {
    const name = (id: string) => {
      const e = L.diagram.edges.find((x) => x.id === id);
      const lbl = (nid: string) => L.diagram.nodes.find((n) => n.id === nid)?.label ?? nid;
      return e ? `${id} (${lbl(e.from)} → ${lbl(e.to)})` : id;
    };
    errors.push(
      `${L.crossings} crossing(s): ${L.crossingPairs.map(([a, b]) => `${name(a)} × ${name(b)}`).join("; ")} — move cells, set fromSide/toSide, or use a frame-sourced edge`,
    );
  }
  if (L.boxHits > 0) errors.push(`${L.boxHits} arrow(s) run under or along a box`);
  if (routed < L.diagram.edges.length) errors.push(`${L.diagram.edges.length - routed} edge(s) could not be routed`);
  if (textItems > 40) warnings.push(`${textItems} text items on screen`);

  const line =
    `zoom ${L.zoom.toFixed(2).padStart(4)}  boxes ${String(boxes.length).padStart(2)}  edges ${String(L.diagram.edges.length).padStart(2)}` +
    `  hot ${hot.length}  cross ${String(L.crossings).padStart(2)}  hits ${L.boxHits}  ${L.onGrid ? "grid" : "px  "}`;
  return { errors, warnings, line };
}

const args = process.argv.slice(2);
const summary = args.includes("--summary");
const want = args.filter((a) => !a.startsWith("--"));
const ids = want.length ? want : Object.keys(DIAGRAMS);
let failed = 0;
let warned = 0;

for (const id of ids) {
  const d = DIAGRAMS[id];
  if (!d) {
    console.error(`✗ ${id}: no such diagram`);
    failed++;
    continue;
  }
  const { errors, warnings, line } = check(d);
  const tag = errors.length ? "✗" : warnings.length ? "~" : "✓";
  if (errors.length) failed++;
  warned += warnings.length;
  console.log(`${tag} ${id.padEnd(22)} ${line}`);
  if (summary) continue;
  for (const m of errors) console.log(`      ${m}`);
  for (const m of warnings) console.log(`      (warn) ${m}`);
}

console.log(`\n${ids.length} diagram(s): ${ids.length - failed} clean, ${failed} failing, ${warned} warning(s)`);
process.exit(failed ? 1 : 0);
