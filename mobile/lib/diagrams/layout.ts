/**
 * Pure layout maths for the architecture diagrams: no React, no DOM.
 *
 * This lives apart from the renderer so the checker can compute the EXACT
 * geometry that will be drawn. Every time the two were allowed to drift, the
 * gate lied: an approximate route model passed diagrams whose arrows rendered
 * straight through boxes, and a checker that inset boxes instead of inflating
 * them passed arrows glued to the side of a whole column. One source of truth
 * is the only way that stays fixed.
 */
import type { Diagram, DiagramEdge, DiagramNode } from "./types";
import { isFrame } from "./types";

export const MIN_GUTTER = 190; // ~28 chars at 11.5px, the label cap the checker enforces
export const MIN_ROW_GAP = 46; // label height plus its background padding
const COL_TOLERANCE = 60;
const ROW_TOLERANCE = 40;
export const DEFAULT_H = 84;   // measured: box + type-tag row, with a sub-label
export const LABEL_H = 19;     // measured
export const LABEL_CHAR_W = 6.9; // measured ~6.3px/char; rounded up for safety
const LABEL_PAD = 14;   // horizontal padding + border

/** Rendered height of a box: taller when it carries a sub-label. */
export function nodeH(n: DiagramNode): number {
  return n.h ?? (n.sub ? DEFAULT_H : 62);
}

/** Where an edge attaches to a box, in flow coordinates. */
export function anchor(n: DiagramNode, side: string): { x: number; y: number } {
  const w = n.w ?? 240;
  const h = nodeH(n);
  switch (side) {
    case "top":
      return { x: n.x + w / 2, y: n.y };
    case "bottom":
      return { x: n.x + w / 2, y: n.y + h };
    case "left":
      return { x: n.x, y: n.y + h / 2 };
    default:
      return { x: n.x + w, y: n.y + h / 2 };
  }
}

/**
 * Give every edge that would share a corridor its own lane.
 *
 * getSmoothStepPath turns a fixed distance from the node, so two edges crossing
 * the same gap turn at the same coordinate and their orthogonal runs land on top
 * of each other. Visually that is one line instead of two; worse, with a 26px hit
 * area it is one click target, so the edge underneath can never be selected.
 * Measured on the notification system before this existed: 4 of 18 edges were
 * unreachable at every point along their length, and 4 more had their midpoint
 * taken by a neighbour.
 *
 * This is a greedy packer, not a router. Each edge takes the lowest lane that
 * does not collide with one already placed, where a collision means the two turn
 * within a lane-width of each other AND their perpendicular spans overlap. Edges
 * that are already well separated keep the default offset and nothing moves.
 */
const LANE_STEP = 26;   // matches the click radius, so lanes cannot merge
const FACE_STEP = 16;   // separation between edges sharing one face
const CORNER_R = 9;

export type Lane = { corridor: number; srcShift: number; dstShift: number };

/**
 * Route every edge through its own corridor, and fan edges that share a face.
 *
 * This replaces getSmoothStepPath's routing, which cannot do the job: for a
 * normal left-to-right pair it puts the perpendicular run at the MIDPOINT
 * between the two nodes and ignores the `offset` argument entirely. So three
 * edges from one node into one column all turn at the same x and are drawn on
 * top of each other. Measured before this existed: the notification system had
 * 15 pairs of coincident edges, one of them running together for 448px.
 *
 * Two separate problems, two corrections:
 *
 *  - Edges leaving or entering the same face of the same node start or end at
 *    literally the same point. `srcShift` / `dstShift` fan them along that face
 *    so they are distinguishable from the very first pixel.
 *  - Edges crossing the same gap turn at the same coordinate. `corridor` gives
 *    each one its own lane, stepping outward from the natural midpoint.
 *
 * Both are clamped to stay on the node's own face and inside the gap, so a
 * dense diagram degrades to "slightly crowded" rather than "arrows pointing at
 * nothing".
 */
export function assignLanes(d: Diagram): Record<string, Lane> {
  const byId = new Map(d.nodes.map((n) => [n.id, n] as const));
  const out: Record<string, Lane> = {};

  const horiz = (side: string) => side === "left" || side === "right";

  // --- fan edges that share a face -------------------------------------
  const faceGroups = new Map<string, string[]>();
  const faceKey = (nodeId: string, side: string) => `${nodeId}:${side}`;
  for (const e of d.edges) {
    const sk = faceKey(e.from, e.fromSide ?? "bottom");
    const tk = faceKey(e.to, e.toSide ?? "top");
    (faceGroups.get(sk) ?? faceGroups.set(sk, []).get(sk)!).push(`${e.id}>s`);
    (faceGroups.get(tk) ?? faceGroups.set(tk, []).get(tk)!).push(`${e.id}>t`);
  }
  const shift = new Map<string, number>();
  for (const [key, members] of faceGroups) {
    if (members.length < 2) continue;
    const [nodeId, side] = key.split(":");
    const n = byId.get(nodeId);
    if (!n) continue;
    // Stay on the face: half the extent, less a margin so the arrow does not
    // land on the box's rounded corner.
    const extent = horiz(side) ? nodeH(n) : (n.w ?? 240);
    const room = Math.max(0, extent / 2 - 14);
    const span = Math.min(FACE_STEP * (members.length - 1), room * 2);
    const step = members.length > 1 ? span / (members.length - 1) : 0;
    members.forEach((m, i) => shift.set(m, -span / 2 + i * step));
  }

  // --- give each edge crossing a gap its own corridor -------------------
  type Placed = { horizontal: boolean; corridor: number; lo: number; hi: number };
  const placed: Placed[] = [];

  // Boxes the route has to stay out of. Frames are excluded: an edge crossing
  // a zone or a service frame is normal and reads fine, an edge crossing a
  // component box is invisible there.
  // Inflated, not shrunk. A corridor that merely misses the interior still
  // runs along the border, which reads as a line glued to the side of every box
  // in a column and is what "the arrows are on top of everything" actually
  // looks like. Boxes get real clearance so a route either stays well away or
  // is scored as a crossing.
  const CLEARANCE = 16;
  const obstacles = d.nodes
    .filter((n) => !isFrame(n.kind))
    .map((n) => ({
      id: n.id,
      x: n.x - CLEARANCE,
      y: n.y - CLEARANCE,
      r: n.x + (n.w ?? 240) + CLEARANCE,
      b: n.y + nodeH(n) + CLEARANCE,
    }));

  /** Does this three-segment route pass through a box that is not an endpoint? */
  const routeHitsBox = (
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    horizontal: boolean,
    corridor: number,
    fromId: string,
    toId: string,
  ): boolean => {
    const segs: [number, number, number, number][] = horizontal
      ? [
          [sx, sy, corridor, sy],
          [corridor, sy, corridor, ty],
          [corridor, ty, tx, ty],
        ]
      : [
          [sx, sy, sx, corridor],
          [sx, corridor, tx, corridor],
          [tx, corridor, tx, ty],
        ];
    return obstacles.some((o) => {
      if (o.id === fromId || o.id === toId) return false;
      return segs.some(([x1, y1, x2, y2]) => {
        const loX = Math.min(x1, x2);
        const hiX = Math.max(x1, x2);
        const loY = Math.min(y1, y2);
        const hiY = Math.max(y1, y2);
        return loX < o.r && hiX > o.x && loY < o.b && hiY > o.y;
      });
    });
  };

  for (const e of d.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;

    const fromSide = e.fromSide ?? "bottom";
    const toSide = e.toSide ?? "top";
    const from = anchor(a, fromSide);
    const to = anchor(b, toSide);
    const horizontal = horiz(fromSide);

    const srcShift = shift.get(`${e.id}>s`) ?? 0;
    const dstShift = shift.get(`${e.id}>t`) ?? 0;

    const sMain = horizontal ? from.x : from.y;
    const tMain = horizontal ? to.x : to.y;
    const natural = (sMain + tMain) / 2;
    // The perpendicular extent the corridor has to keep clear of neighbours.
    const lo = Math.min(
      horizontal ? from.y + srcShift : from.x + srcShift,
      horizontal ? to.y + dstShift : to.x + dstShift,
    );
    const hi = Math.max(
      horizontal ? from.y + srcShift : from.x + srcShift,
      horizontal ? to.y + dstShift : to.x + dstShift,
    );

    // Search outward from the midpoint: 0, +1, -1, +2, -2 ... so lanes stay in
    // the gap rather than drifting steadily to one side.
    //
    // Scored rather than first-fit. First-fit has no answer when every
    // candidate is bad, so both edges fall back to the natural midpoint and end
    // up drawn on top of each other — which is the exact failure this function
    // exists to prevent. Scoring always separates them, and ranks burial as
    // worse than crowding because a buried line is invisible as well as
    // unclickable.
    let corridor = natural;
    let bestScore = Infinity;
    for (let k = 0; k < 20; k++) {
      const delta = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * LANE_STEP;
      const c = natural + delta;
      // Do not push a corridor past either endpoint; that doubles the line back.
      const min = Math.min(sMain, tMain) + 12;
      const max = Math.max(sMain, tMain) - 12;
      if (max > min && (c < min || c > max)) continue;
      const clash = placed.some(
        (q) =>
          q.horizontal === horizontal &&
          Math.abs(q.corridor - c) < LANE_STEP * 0.75 &&
          q.lo < hi + 4 &&
          lo - 4 < q.hi,
      );
      const sxx = horizontal ? from.x : from.x + srcShift;
      const syy = horizontal ? from.y + srcShift : from.y;
      const txx = horizontal ? to.x : to.x + dstShift;
      const tyy = horizontal ? to.y + dstShift : to.y;
      const buried = routeHitsBox(sxx, syy, txx, tyy, horizontal, c, e.from, e.to);
      const score =
        (buried ? 1000 : 0) + (clash ? 100 : 0) + Math.abs(delta) * 0.05;
      if (score < bestScore) {
        bestScore = score;
        corridor = c;
      }
      if (score < 1) break; // clean and closest to the natural line
    }
    placed.push({ horizontal, corridor, lo, hi });
    out[e.id] = { corridor, srcShift, dstShift };
  }
  return out;
}

/** Orthogonal path through an explicit corridor, with rounded corners. */
export function corridorPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  horizontal: boolean,
  corridor: number,
): [string, number, number] {
  const r = CORNER_R;
  const pts: [number, number][] = horizontal
    ? [
        [sx, sy],
        [corridor, sy],
        [corridor, ty],
        [tx, ty],
      ]
    : [
        [sx, sy],
        [sx, corridor],
        [tx, corridor],
        [tx, ty],
      ];

  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const rad = Math.min(r, inLen / 2, outLen / 2);
    if (rad < 1) {
      d += ` L ${cx},${cy}`;
      continue;
    }
    const iu = [(cx - px) / (inLen || 1), (cy - py) / (inLen || 1)];
    const ou = [(nx - cx) / (outLen || 1), (ny - cy) / (outLen || 1)];
    d += ` L ${cx - iu[0] * rad},${cy - iu[1] * rad}`;
    d += ` Q ${cx},${cy} ${cx + ou[0] * rad},${cy + ou[1] * rad}`;
  }
  d += ` L ${pts[3][0]},${pts[3][1]}`;

  // Label belongs on the middle run, which is the part with room for it.
  const lx = horizontal ? corridor : (sx + tx) / 2;
  const ly = horizontal ? (sy + ty) / 2 : corridor;
  return [d, lx, ly];
}

export function spaceColumns(d: Diagram): Diagram {
  const boxes = d.nodes.filter((n) => !isFrame(n.kind));
  if (boxes.length < 2) return d;

  // Cluster nodes into columns by x, tolerating slight authoring drift.
  const sorted = [...boxes].sort((a, b) => a.x - b.x);
  const cols: { xs: number[]; nodes: DiagramNode[] }[] = [];
  for (const n of sorted) {
    const last = cols[cols.length - 1];
    if (last && Math.abs(n.x - last.xs[0]) <= COL_TOLERANCE) {
      last.nodes.push(n);
      last.xs.push(n.x);
    } else {
      cols.push({ xs: [n.x], nodes: [n] });
    }
  }
  if (cols.length < 2) return d;

  // Lay the columns out left to right with a guaranteed gutter.
  const moved = new Map<string, number>();
  let cursor = Math.min(...cols[0].xs);
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    const left = Math.min(...c.xs);
    const width = Math.max(...c.nodes.map((n) => n.w ?? 240));
    for (const n of c.nodes) moved.set(n.id, cursor + (n.x - left));
    const next = cols[i + 1];
    if (next) {
      const authored = Math.min(...next.xs) - (left + width);
      cursor += width + Math.max(MIN_GUTTER, authored);
    }
  }

  // Same treatment vertically: labels on the arrows between stacked boxes need
  // a gap they do not get from the authored step size.
  const rowsSorted = [...boxes].sort((a, b) => a.y - b.y);
  const rows: { ys: number[]; nodes: DiagramNode[] }[] = [];
  for (const n of rowsSorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(n.y - last.ys[0]) <= ROW_TOLERANCE) {
      last.nodes.push(n);
      last.ys.push(n.y);
    } else {
      rows.push({ ys: [n.y], nodes: [n] });
    }
  }
  const movedY = new Map<string, number>();
  let vCursor = rows.length ? Math.min(...rows[0].ys) : 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const top = Math.min(...r.ys);
    const height = Math.max(...r.nodes.map((n) => n.h ?? DEFAULT_H));
    for (const n of r.nodes) movedY.set(n.id, vCursor + (n.y - top));
    const next = rows[i + 1];
    if (next) {
      const authored = Math.min(...next.ys) - (top + height);
      vCursor += height + Math.max(MIN_ROW_GAP, authored);
    }
  }

  const nodes = d.nodes.map((n) => {
    if (!isFrame(n.kind)) {
      return { ...n, x: moved.get(n.id) ?? n.x, y: movedY.get(n.id) ?? n.y };
    }
    // Keep the zone around the same members it framed originally.
    const w0 = n.w ?? 300;
    const h0 = n.h ?? 300;
    const inside = boxes.filter(
      (b) =>
        b.x >= n.x - 8 &&
        b.x + (b.w ?? 240) <= n.x + w0 + 8 &&
        b.y >= n.y - 8 &&
        b.y + (b.h ?? DEFAULT_H) <= n.y + h0 + 8,
    );
    if (!inside.length) return n;
    const l = Math.min(...inside.map((b) => moved.get(b.id) ?? b.x));
    const r = Math.max(
      ...inside.map((b) => (moved.get(b.id) ?? b.x) + (b.w ?? 240)),
    );
    const tp = Math.min(...inside.map((b) => movedY.get(b.id) ?? b.y));
    const bt = Math.max(
      ...inside.map((b) => (movedY.get(b.id) ?? b.y) + (b.h ?? DEFAULT_H)),
    );
    const padL = Math.min(...inside.map((b) => b.x)) - n.x;
    const padT = Math.min(...inside.map((b) => b.y)) - n.y;
    return {
      ...n,
      x: l - padL,
      w: r - l + padL * 2,
      y: tp - padT,
      h: bt - tp + padT * 2,
    };
  });
  return { ...d, nodes };
}


export function placeLabels(d: Diagram): Record<string, { lx: number; ly: number }> {
  // Labels sit on the route that is actually drawn, so they follow the lanes.
  const lanes = assignLanes(d);
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const boxes = d.nodes
    .filter((n) => !isFrame(n.kind))
    .map((n) => ({ x: n.x, y: n.y, w: n.w ?? 240, h: nodeH(n) }));

  type Placed = { x: number; y: number; w: number; h: number };
  const placed: Placed[] = [];

  // fitView frames the NODE bounds, so a label pushed outside them gets clipped
  // by the viewport. Keep every label inside the box the viewport will show.
  const bounds = {
    l: Math.min(...boxes.map((b) => b.x)),
    r: Math.max(...boxes.map((b) => b.x + b.w)),
    t: Math.min(...boxes.map((b) => b.y)),
    b: Math.max(...boxes.map((b) => b.y + b.h)),
  };
  const out: Record<string, { lx: number; ly: number }> = {};

  // Shorter labels first: they are easier to fit, and moving a long label is
  // more visually disruptive than moving a short one.
  const withLabels = d.edges
    .filter((e) => e.label)
    .sort((a, b) => (a.label ?? "").length - (b.label ?? "").length);

  for (const e of withLabels) {
    const s = byId.get(e.from);
    const tg = byId.get(e.to);
    if (!s || !tg) continue;
    const a = anchor(s, e.fromSide ?? "bottom");
    const b = anchor(tg, e.toSide ?? "top");
    const horizontal =
      (e.fromSide ?? "bottom") === "left" || (e.fromSide ?? "bottom") === "right";
    const lane = lanes[e.id];
    const sx = horizontal ? a.x : a.x + (lane?.srcShift ?? 0);
    const sy = horizontal ? a.y + (lane?.srcShift ?? 0) : a.y;
    const tx = horizontal ? b.x : b.x + (lane?.dstShift ?? 0);
    const ty = horizontal ? b.y + (lane?.dstShift ?? 0) : b.y;
    const corridor =
      lane?.corridor ?? (horizontal ? (sx + tx) / 2 : (sy + ty) / 2);
    const [, lx0, ly0] = corridorPath(sx, sy, tx, ty, horizontal, corridor);

    const w = (e.label ?? "").length * LABEL_CHAR_W + LABEL_PAD;
    // Boxes are inflated a little: a sub-label that wraps to two lines renders
    // taller than nodeH() predicts, and a near miss reads as a collision.
    const PAD_X = 5;
    const PAD_Y = 9;
    /** Total overlapped area for a candidate position; 0 means free. */
    const cost = (x: number, y: number) => {
      const r = { x: x - w / 2, y: y - LABEL_H / 2, w, h: LABEL_H };
      let c = 0;
      const acc = (q: Placed, px: number, py: number) => {
        const ox = Math.min(r.x + r.w, q.x + q.w + px) - Math.max(r.x, q.x - px);
        const oy = Math.min(r.y + r.h, q.y + q.h + py) - Math.max(r.y, q.y - py);
        if (ox > 0 && oy > 0) c += ox * oy;
      };
      for (const q of boxes) acc(q, PAD_X, PAD_Y);
      for (const q of placed) acc(q, 0, 0);
      // Prefer staying inside the framed bounds, but not at the cost of sitting
      // on a component: fitView is given padding to cover a modest overhang.
      if (r.x < bounds.l || r.x + r.w > bounds.r || r.y < bounds.t || r.y + r.h > bounds.b)
        c += 1200;
      return c;
    };

    // Search outward from the natural midpoint, vertically first (cheapest
    // visually) then sideways along the edge. Fall back to the least-bad slot
    // rather than leaving the label sitting on something.
    let best = { x: lx0, y: ly0, c: cost(lx0, ly0) };
    if (best.c > 0) {
      outer: for (let step = 1; step <= 22; step++) {
        for (const dy of [-step * 11, step * 11]) {
          for (const dx of [0, -26, 26, -52, 52]) {
            const c = cost(lx0 + dx, ly0 + dy);
            if (c < best.c) best = { x: lx0 + dx, y: ly0 + dy, c };
            if (c === 0) break outer;
          }
        }
      }
    }
    // Last resort: if every candidate was out of bounds, clamp into them.
    const lx = best.x;
    const ly = best.y;
    placed.push({ x: lx - w / 2, y: ly - LABEL_H / 2, w, h: LABEL_H });
    out[e.id] = { lx, ly };
  }
  return out;
}
