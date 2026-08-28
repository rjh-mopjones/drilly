/**
 * One-off migration: turn a spec's pixel x/y into grid col/row.
 *
 * Clusters boxes into columns and rows with the same tolerances the old
 * spacer used, derives frame membership from geometric containment, and
 * rewrites the spec file in place: `x`/`y`/`w`/`h` lines become `col`/`row`
 * (and `parent`), frames lose their size entirely because the renderer sizes
 * them from their members.
 *
 * This is a starting point, not a floorplan. Most specs will fail the gate
 * afterwards on zoom (too many rows) or crossings; fixing that means moving
 * cells by hand, which is the whole point of the grid.
 *
 * Run: bunx tsx scripts/snap-diagrams-to-grid.ts [id ...]
 */
declare const process: { argv: string[]; exit(code: number): never };
import { readFileSync, writeFileSync } from "node:fs";
import { DIAGRAMS } from "../mobile/lib/diagrams";
import { isFrame, type Diagram, type DiagramNode } from "../mobile/lib/diagrams/types";
import { parentOf } from "../mobile/lib/diagrams/layout";

const COL_TOL = 60;
const ROW_TOL = 40;

function cluster(values: { id: string; v: number }[], tol: number): Map<string, number> {
  const sorted = [...values].sort((a, b) => a.v - b.v);
  const out = new Map<string, number>();
  let idx = -1;
  let anchor = -Infinity;
  for (const { id, v } of sorted) {
    if (v - anchor > tol) {
      idx++;
      anchor = v;
    }
    out.set(id, idx);
  }
  return out;
}

function plan(d: Diagram): Map<string, { col?: number; row?: number; parent?: string }> {
  const boxes = d.nodes.filter((n) => !isFrame(n.kind));
  const cols = cluster(boxes.map((n) => ({ id: n.id, v: n.x ?? 0 })), COL_TOL);
  const rows = cluster(boxes.map((n) => ({ id: n.id, v: n.y ?? 0 })), ROW_TOL);
  const out = new Map<string, { col?: number; row?: number; parent?: string }>();
  for (const n of d.nodes) {
    const parent = parentOf(n, d);
    if (!isFrame(n.kind)) {
      out.set(n.id, { col: cols.get(n.id), row: rows.get(n.id), parent });
      continue;
    }
    // A serviceGroup collapses to one box: it needs a cell of its own, the
    // top-left of its stages. Zones only need membership.
    if (n.kind === "serviceGroup") {
      const stages = boxes.filter((b) => parentOf(b, d) === n.id);
      const first = [...stages].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))[0];
      out.set(n.id, { col: first ? cols.get(first.id) : 0, row: first ? rows.get(first.id) : 0, parent });
    } else out.set(n.id, { parent });
  }
  return out;
}

function rewrite(file: string, d: Diagram): number {
  const src = readFileSync(file, "utf8");
  const p = plan(d);
  let out = src;
  let changed = 0;
  for (const n of d.nodes) {
    const cell = p.get(n.id);
    if (!cell) continue;
    // Locate this node's object: from its `id: "..."` line to the next `id:` at the same indent.
    const idRe = new RegExp(`^(\\s+)id: "${n.id}",\\n`, "m");
    const m = idRe.exec(out);
    if (!m) continue;
    const indent = m[1];
    const start = m.index;
    const nextId = out.indexOf(`\n${indent}id: "`, start + m[0].length);
    const endGuess = nextId < 0 ? out.length : nextId;
    let block = out.slice(start, endGuess);
    const before = block;
    // Strip geometry lines (only at this indent).
    block = block.replace(new RegExp(`^${indent}(x|y|w|h): [^\\n]*\\n`, "gm"), "");
    const lines: string[] = [];
    if (cell.col != null) lines.push(`${indent}col: ${cell.col},`);
    if (cell.row != null) lines.push(`${indent}row: ${cell.row},`);
    if (cell.parent) lines.push(`${indent}parent: "${cell.parent}",`);
    // Insert after the `kind:` line so the order reads id/label/sub/kind/cell.
    const kindRe = new RegExp(`^(${indent}kind: [^\\n]*\\n)`, "m");
    if (kindRe.test(block)) block = block.replace(kindRe, `$1${lines.join("\n")}${lines.length ? "\n" : ""}`);
    else block = block.replace(idRe, `$&${lines.join("\n")}\n`);
    if (block !== before) changed++;
    out = out.slice(0, start) + block + out.slice(endGuess);
  }
  if (out !== src) writeFileSync(file, out);
  return changed;
}

const want = process.argv.slice(2);
const ids = want.length ? want : Object.keys(DIAGRAMS);
for (const id of ids) {
  const d = DIAGRAMS[id];
  if (!d) {
    console.error(`no such diagram: ${id}`);
    continue;
  }
  const n = rewrite(`mobile/lib/diagrams/${id}.ts`, d);
  console.log(`${id.padEnd(22)} ${n} nodes snapped`);
}
