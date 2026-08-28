/**
 * Geometry and vocabulary gate for the architecture diagram specs.
 *
 * CLAUDE.md referred to a `check-spec.ts` for years; it never existed, so every
 * rule below was previously enforced by looking at a screenshot. These are the
 * failures that are invisible in code review and obvious in the browser:
 *
 *  - Two boxes overlapping. Reads as one box with garbled text.
 *  - An edge routed under a box. The line, its label and its arrowhead are all
 *    drawn and all hidden, and the arrow cannot be clicked there either.
 *  - An edge label over ~28 characters. Collides even at the minimum gutter.
 *  - A `process` outside a `serviceGroup`. A process is a stage inside a
 *    service; standing alone it makes a deployment claim that is false.
 *  - A frame that does not actually enclose the nodes it is meant to frame.
 *
 * Run: bunx tsx scripts/check-diagrams.ts [id ...]
 * Exit 1 on any error. Warnings do not fail the build.
 */
// scripts/ is outside mobile/tsconfig.json, which owns the only @types set in
// this workspace, so the node globals are declared rather than imported.
declare const process: { argv: string[]; exit(code: number): never };

import { DIAGRAMS } from "../mobile/lib/diagrams";
import { isFrame, type Diagram, type DiagramNode } from "../mobile/lib/diagrams/types";

const MAX_LABEL = 28;
/** Matches nodeH() in ArchDiagram.web.tsx: box + type-tag row, with a sub-label. */
const DEFAULT_H = 84;
const NO_SUB_H = 62;
const DEFAULT_W = 240;

type Rect = { x: number; y: number; w: number; h: number };

function rectOf(n: DiagramNode): Rect {
  return {
    x: n.x,
    y: n.y,
    w: n.w ?? DEFAULT_W,
    h: n.h ?? (n.sub ? DEFAULT_H : NO_SUB_H),
  };
}

function overlaps(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.x + a.w + pad > b.x &&
    b.x + b.w + pad > a.x &&
    a.y + a.h + pad > b.y &&
    b.y + b.h + pad > a.y
  );
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function anchor(r: Rect, side?: string): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: r.x + r.w / 2, y: r.y };
    case "bottom":
      return { x: r.x + r.w / 2, y: r.y + r.h };
    case "left":
      return { x: r.x, y: r.y + r.h / 2 };
    case "right":
      return { x: r.x + r.w, y: r.y + r.h / 2 };
    default:
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }
}

/**
 * Does the orthogonal route from a to b pass through `box`?
 *
 * Approximates getSmoothStepPath as an L: out along the dominant axis, then
 * across. That is not the exact curve, but a spec whose straight-line L crosses
 * a box will route across it under any step router, so it is the right thing to
 * fail on.
 */
function routeCrosses(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: Rect,
): boolean {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
  const segs: [number, number, number, number][] = horizontal
    ? [
        [a.x, a.y, midX, a.y],
        [midX, a.y, midX, b.y],
        [midX, b.y, b.x, b.y],
      ]
    : [
        [a.x, a.y, a.x, midY],
        [a.x, midY, b.x, midY],
        [b.x, midY, b.x, b.y],
      ];
  // Shrink the box slightly: a segment that only grazes the border is where the
  // edge legitimately attaches.
  const pad = 4;
  const r = { x: box.x + pad, y: box.y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad };
  return segs.some(([x1, y1, x2, y2]) => {
    const lo = { x: Math.min(x1, x2), y: Math.min(y1, y2) };
    const hi = { x: Math.max(x1, x2), y: Math.max(y1, y2) };
    return lo.x < r.x + r.w && hi.x > r.x && lo.y < r.y + r.h && hi.y > r.y;
  });
}

function check(d: Diagram): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const boxes = d.nodes.filter((n) => !isFrame(n.kind));
  const frames = d.nodes.filter((n) => isFrame(n.kind));

  // --- ids ---
  const seen = new Set<string>();
  for (const n of d.nodes) {
    if (seen.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
    seen.add(n.id);
  }

  // --- boxes must not overlap each other ---
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(rectOf(boxes[i]), rectOf(boxes[j]))) {
        errors.push(`boxes overlap: "${boxes[i].label}" / "${boxes[j].label}"`);
      }
    }
  }

  // --- a process is a stage inside a service, never a peer ---
  const serviceGroups = frames.filter((f) => f.kind === "serviceGroup");
  for (const n of boxes.filter((b) => b.kind === "process")) {
    const home = serviceGroups.find((f) => contains(rectOf(f), rectOf(n)));
    if (!home) {
      errors.push(`process "${n.label}" is not inside any serviceGroup frame`);
    }
  }
  if (serviceGroups.length && !boxes.some((b) => b.kind === "process")) {
    warnings.push("a serviceGroup frame with no process nodes inside it");
  }

  // --- a nested frame must clear the outer frame's header ---
  // A zone draws its name on a chip at its top-left; a serviceGroup draws a
  // header strip. Nest one right at the other's top edge and the two names
  // render on top of each other. Nothing else catches this: neither is a box,
  // so the overlap rules above never look at them.
  const FRAME_HEADER_H = 34;
  for (const outer of frames) {
    for (const inner of frames) {
      if (outer.id === inner.id) continue;
      if (!contains(rectOf(outer), rectOf(inner))) continue;
      if (rectOf(inner).y - rectOf(outer).y < FRAME_HEADER_H) {
        errors.push(
          `frame "${inner.label}" starts inside the header of "${outer.label}" — ` +
            `their titles will overlap; drop it at least ${FRAME_HEADER_H}px lower`,
        );
      }
    }
  }

  // --- frames need real size ---
  for (const f of frames) {
    if (!f.w || !f.h) errors.push(`frame "${f.label}" needs both w and h`);
    const members = boxes.filter((b) => overlaps(rectOf(f), rectOf(b)));
    for (const m of members) {
      if (!contains(rectOf(f), rectOf(m))) {
        errors.push(`frame "${f.label}" clips "${m.label}" — enlarge it or move the box out`);
      }
    }
  }

  // --- edges ---
  for (const e of d.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a) { errors.push(`edge ${e.id}: no node "${e.from}"`); continue; }
    if (!b) { errors.push(`edge ${e.id}: no node "${e.to}"`); continue; }
    if (e.label && e.label.length > MAX_LABEL) {
      errors.push(`edge ${e.id} label ${e.label.length} chars (max ${MAX_LABEL}): "${e.label}"`);
    }
    if (!e.detail) warnings.push(`edge ${e.id} has no detail; a click on it shows nothing`);

    const from = anchor(rectOf(a), e.fromSide ?? "bottom");
    const to = anchor(rectOf(b), e.toSide ?? "top");
    for (const box of boxes) {
      if (box.id === e.from || box.id === e.to) continue;
      if (routeCrosses(from, to, rectOf(box))) {
        errors.push(`edge ${e.id} (${a.label} → ${b.label}) routes across "${box.label}"`);
      }
    }
  }

  for (const n of boxes) {
    if (!n.detail) warnings.push(`node "${n.label}" has no detail`);
  }

  return { errors, warnings };
}

const want = process.argv.slice(2);
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
  const { errors, warnings } = check(d);
  if (errors.length) {
    failed++;
    console.error(`\n✗ ${id}`);
    for (const m of errors) console.error(`    ${m}`);
    for (const m of warnings) console.error(`    (warn) ${m}`);
  } else if (warnings.length) {
    warned += warnings.length;
    console.log(`~ ${id} — ${warnings.length} warning(s)`);
    for (const m of warnings) console.log(`    ${m}`);
  } else {
    console.log(`✓ ${id}`);
  }
}

console.log(
  `\n${ids.length} diagram(s): ${ids.length - failed} clean, ${failed} failing, ${warned} warning(s)`,
);
process.exit(failed ? 1 : 0);
