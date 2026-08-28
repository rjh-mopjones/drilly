/** Outward unit normal of a node face. */
export function dirOf(side: string | undefined): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    default:
      return { x: 1, y: 0 };
  }
}

/**
 * How far an edge runs straight out of a face before it is allowed to turn.
 * Without this an arrow can arrive parallel to the border it is pointing at,
 * which is what "the arrows are not going into the node" looks like.
 */
export const STUB = 20;

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

export type Lane = {
  corridor: number;
  srcShift: number;
  dstShift: number;
  /** The face actually used, which may not be the one the spec asked for. */
  fromSide: string;
  toSide: string;
};

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

  // --- give each edge crossing a gap its own corridor -------------------
  type Placed = { horizontal: boolean; corridor: number; lo: number; hi: number };
  const placed: Placed[] = [];
  /** Segments of the routes already committed, for counting crossings. */
  const placedSegs: [number, number, number, number][][] = [];
  const chosen: { id: string; fromSide: string; toSide: string; from: string; to: string }[] = [];

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


  /** Do two axis-aligned segments properly cross? */
  const segsCross = (
    p: [number, number, number, number],
    q: [number, number, number, number],
  ): boolean => {
    const [ax1, ay1, ax2, ay2] = p;
    const [bx1, by1, bx2, by2] = q;
    const aH = Math.abs(ay1 - ay2) < 0.5;
    const bH = Math.abs(by1 - by2) < 0.5;
    if (aH === bH) return false; // parallel runs are handled by the lane rules
    const h = aH ? p : q;
    const v = aH ? q : p;
    const hy = h[1];
    const hx1 = Math.min(h[0], h[2]);
    const hx2 = Math.max(h[0], h[2]);
    const vx = v[0];
    const vy1 = Math.min(v[1], v[3]);
    const vy2 = Math.max(v[1], v[3]);
    return vx > hx1 + 1 && vx < hx2 - 1 && hy > vy1 + 1 && hy < vy2 - 1;
  };

  const crossingCount = (segs: [number, number, number, number][]): number => {
    let n = 0;
    for (const other of placedSegs)
      for (const a of segs) for (const b of other) if (segsCross(a, b)) n++;
    return n;
  };

  /** Does the route pass through a box that is not one of its endpoints? */
  const routeHitsBox = (
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    fromSide: string | undefined,
    toSide: string | undefined,
    corridor: number,
    fromId: string,
    toId: string,
  ): boolean => {
    const segs = routeSegments(sx, sy, tx, ty, fromSide, toSide, corridor);
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

    // Which faces to use. An authored fromSide/toSide is a preference, not an
    // order: a face chosen by hand for one router shape becomes wrong when the
    // route shape changes, and re-tuning every spec by hand does not scale.
    // Try the authored pair first, then pairs whose normals actually point at
    // the other node, and take the first that does not plough through a box.
    const faces = ["right", "left", "bottom", "top"] as const;
    const ra = { x: a.x, y: a.y, w: a.w ?? 240, h: nodeH(a) };
    const rb = { x: b.x, y: b.y, w: b.w ?? 240, h: nodeH(b) };
    const dx = rb.x + rb.w / 2 - (ra.x + ra.w / 2);
    const dy = rb.y + rb.h / 2 - (ra.y + ra.h / 2);
    /** Faces of A ordered by how well they point at B. */
    const rank = (towardX: number, towardY: number) =>
      [...faces].sort((p, q) => {
        const d1 = dirOf(p);
        const d2 = dirOf(q);
        return d2.x * towardX + d2.y * towardY - (d1.x * towardX + d1.y * towardY);
      });
    const srcOrder = rank(dx, dy);
    const dstOrder = rank(-dx, -dy);

    const candidates: [string, string][] = [];
    if (e.fromSide || e.toSide) {
      candidates.push([e.fromSide ?? srcOrder[0], e.toSide ?? dstOrder[0]]);
    }
    for (const fs of srcOrder) for (const ts of dstOrder) candidates.push([fs, ts]);

    // Score the face pairs rather than taking the first that avoids a box.
    // Which faces an edge uses decides far more about crossings than which lane
    // it later picks, so crossings have to be weighed here or the lane search is
    // just tidying up a bad decision.
    let fromSide = candidates[0][0];
    let toSide = candidates[0][1];
    let faceBest = Infinity;
    candidates.forEach(([fs, ts], rank) => {
      const fa = anchor(a, fs);
      const ta = anchor(b, ts);
      const h = horiz(fs);
      const natural = h ? (fa.x + ta.x) / 2 : (fa.y + ta.y) / 2;
      // Score the face pair on the BEST corridor available to it, not just the
      // natural one. Testing only the midpoint rejected face pairs that are
      // perfectly good once the lane search shifts them, which is how an edge
      // ended up ploughing through the box stacked between its endpoints.
      let bestForPair = Infinity;
      for (let k = 0; k < 16; k++) {
        const delta = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * LANE_STEP;
        const c = natural + delta;
        const buried = routeHitsBox(fa.x, fa.y, ta.x, ta.y, fs, ts, c, e.from, e.to);
        const segs = routeSegments(fa.x, fa.y, ta.x, ta.y, fs, ts, c);
        const s = (buried ? 1000 : 0) + crossingCount(segs) * 90 + Math.abs(delta) * 0.02;
        if (s < bestForPair) bestForPair = s;
        if (s < 1) break;
      }
      const score = bestForPair + rank * 2;
      if (score < faceBest) {
        faceBest = score;
        fromSide = fs;
        toSide = ts;
      }
    });

    const from = anchor(a, fromSide);
    const to = anchor(b, toSide);
    // The corridor runs along the source's axis, for every edge.
    const horizontal = horiz(fromSide);

    // Face fanning happens in a second pass below, once every edge has settled
    // on which face it is actually using.
    const srcShift = 0;
    const dstShift = 0;

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
    for (let k = 0; k < 40; k++) {
      const delta = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * LANE_STEP;
      const c = natural + delta;
      // Going past an endpoint doubles the line back on itself, so it is a
      // penalty rather than a veto: a route that leaves the span is still much
      // better than one that ploughs through a component.
      const min = Math.min(sMain, tMain) + 12;
      const max = Math.max(sMain, tMain) - 12;
      const outside = max > min && (c < min || c > max);
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
      const buried = routeHitsBox(sxx, syy, txx, tyy, fromSide, toSide, c, e.from, e.to);
      const segs = routeSegments(sxx, syy, txx, tyy, fromSide, toSide, c);
      // Crossings are weighted above almost everything except burial: a long
      // way round is preferable to two lines crossing, which is the single
      // thing that makes these diagrams unreadable.
      const crossings = crossingCount(segs);
      const score =
        (buried ? 1000 : 0) +
        crossings * 90 +
        (clash ? 100 : 0) +
        // Leaving the endpoint span is a mild cost now, not a real one: a
        // detour that avoids a crossing is a good trade.
        (outside ? 8 : 0) +
        Math.abs(delta) * 0.01;
      if (score < bestScore) {
        bestScore = score;
        corridor = c;
      }
      if (score < 1) break; // clean and closest to the natural line
    }
    placed.push({ horizontal, corridor, lo, hi });
    placedSegs.push(
      routeSegments(
        horizontal ? from.x : from.x + srcShift,
        horizontal ? from.y + srcShift : from.y,
        horizontal ? to.x : to.x + dstShift,
        horizontal ? to.y + dstShift : to.y,
        fromSide,
        toSide,
        corridor,
      ),
    );
    out[e.id] = { corridor, srcShift, dstShift, fromSide, toSide };
    chosen.push({ id: e.id, fromSide, toSide, from: e.from, to: e.to });
  }
  // --- second pass: fan edges that ended up sharing a face ---------------
  // This has to come after face selection: two edges only collide at a node if
  // they chose the SAME face, and that is not known until the loop above ends.
  const byFace = new Map<string, { id: string; end: "s" | "t" }[]>();
  for (const c of chosen) {
    const sk = `${c.from}:${c.fromSide}`;
    const tk = `${c.to}:${c.toSide}`;
    (byFace.get(sk) ?? byFace.set(sk, []).get(sk)!).push({ id: c.id, end: "s" });
    (byFace.get(tk) ?? byFace.set(tk, []).get(tk)!).push({ id: c.id, end: "t" });
  }
  for (const [key, members] of byFace) {
    if (members.length < 2) continue;
    const idx = key.lastIndexOf(":");
    const n = byId.get(key.slice(0, idx));
    const side = key.slice(idx + 1);
    if (!n) continue;
    // Stay on the face, clear of the rounded corners.
    // Fan every edge on a shared face. An earlier attempt to fan only the ones
    // whose corridors already collided looked tidier in isolation and was much
    // worse overall: crossings went 36 -> 55 and 19 pairs of edges became
    // coincident again. Edges leaving one point need to separate at the point.
    const extent = horiz(side) ? nodeH(n) : (n.w ?? 240);
    const room = Math.max(0, extent / 2 - 14);
    const span = Math.min(FACE_STEP * (members.length - 1), room * 2);
    const step = members.length > 1 ? span / (members.length - 1) : 0;
    members.forEach((m, i) => {
      const lane = out[m.id];
      if (!lane) return;
      const v = -span / 2 + i * step;
      if (m.end === "s") lane.srcShift = v;
      else lane.dstShift = v;
    });
  }

  return out;
}

/**
 * The corner points of a route, and the single definition of its shape.
 *
 * corridorPath draws these, assignLanes tests them against boxes, and
 * check-diagrams.ts gates on them. Keeping one function means the drawing and
 * the gate cannot drift apart, which they did twice before this existed.
 */
export function routePoints(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  fromSide: string | undefined,
  toSide: string | undefined,
  corridor: number,
): [number, number][] {
  const sd = dirOf(fromSide);
  const td = dirOf(toSide);
  const ex = sx + sd.x * STUB;
  const ey = sy + sd.y * STUB;
  const ax = tx + td.x * STUB;
  const ay = ty + td.y * STUB;
  const srcH = sd.y === 0;
  const dstH = td.y === 0;

  // The corridor always runs along the SOURCE's axis. A mixed pair used to get
  // a single fixed corner instead, which left the lane search nothing to vary,
  // so those routes could not be steered around a box in the way. The final
  // stub is what guarantees a perpendicular arrival, so the middle is free to
  // take any orthogonal shape.
  const mid: [number, number][] = srcH
    ? [
        [corridor, ey],
        [corridor, ay],
      ]
    : [
        [ex, corridor],
        [ax, corridor],
      ];
  void dstH;

  const pts: [number, number][] = [[sx, sy], [ex, ey], ...mid, [ax, ay], [tx, ty]];
  const clean: [number, number][] = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 0.5 && Math.abs(last[1] - p[1]) < 0.5) continue;
    clean.push(p);
  }

  // Collapse a stub of a run between two parallel runs. Left alone it renders
  // as a small step in an otherwise straight line — a kink that carries no
  // information and makes a diagram look untidy. Both endpoints are fixed, so
  // only interior points move.
  const JOG = 14;
  for (let i = 1; i < clean.length - 2; i++) {
    const [x1, y1] = clean[i];
    const [x2, y2] = clean[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len >= JOG || len === 0) continue;
    const before = clean[i - 1];
    const after = clean[i + 2];
    const beforeH = Math.abs(before[1] - y1) < 0.5;
    const afterH = Math.abs(after[1] - y2) < 0.5;
    if (beforeH !== afterH) continue; // a real corner, not a jog
    if (beforeH) {
      const y = (y1 + y2) / 2;
      clean[i] = [x1, y];
      clean[i + 1] = [x2, y];
    } else {
      const x = (x1 + x2) / 2;
      clean[i] = [x, y1];
      clean[i + 1] = [x, y2];
    }
  }
  return clean;
}

/** The same route as line segments, for hit testing. */
export function routeSegments(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  fromSide: string | undefined,
  toSide: string | undefined,
  corridor: number,
): [number, number, number, number][] {
  const p = routePoints(sx, sy, tx, ty, fromSide, toSide, corridor);
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < p.length - 1; i++) out.push([p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]]);
  return out;
}



/**
 * Orthogonal route that leaves the source perpendicular to its face and
 * arrives at the target perpendicular to ITS face.
 *
 * The previous version chose one orientation from the source side alone and
 * ignored the target's. An edge leaving `right` and entering `top` therefore
 * finished with a horizontal run into a horizontal face: the line slid along
 * the top border and the arrowhead landed in the middle of the box instead of
 * on its edge. Both ends now get a perpendicular stub, and the corridor only
 * governs the middle.
 */
export function corridorPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  fromSide: string | undefined,
  toSide: string | undefined,
  corridor: number,
): [string, number, number] {
  const clean = routePoints(sx, sy, tx, ty, fromSide, toSide, corridor);

  const r = CORNER_R;
  let d = `M ${clean[0][0]},${clean[0][1]}`;
  for (let i = 1; i < clean.length - 1; i++) {
    const [px, py] = clean[i - 1];
    const [cx, cy] = clean[i];
    const [nx, ny] = clean[i + 1];
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
  const end = clean[clean.length - 1];
  d += ` L ${end[0]},${end[1]}`;

  // Label goes on the longest straight run, which is the one with room for it.
  let best = { len: -1, x: (sx + tx) / 2, y: (sy + ty) / 2 };
  for (let i = 0; i < clean.length - 1; i++) {
    const [x1, y1] = clean[i];
    const [x2, y2] = clean[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > best.len) best = { len, x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }
  return [d, best.x, best.y];
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

    const lane0 = lanes[e.id];
    const fromSide = lane0?.fromSide ?? e.fromSide ?? "bottom";
    const toSide = lane0?.toSide ?? e.toSide ?? "top";
    const srcH = fromSide === "left" || fromSide === "right";
    const dstH = toSide === "left" || toSide === "right";
    const a = anchor(s, fromSide);
    const b = anchor(tg, toSide);
    const lane = lane0;
    const sx = srcH ? a.x : a.x + (lane?.srcShift ?? 0);
    const sy = srcH ? a.y + (lane?.srcShift ?? 0) : a.y;
    const tx = dstH ? b.x : b.x + (lane?.dstShift ?? 0);
    const ty = dstH ? b.y + (lane?.dstShift ?? 0) : b.y;
    const corridor = lane?.corridor ?? (srcH ? (sx + tx) / 2 : (sy + ty) / 2);
    const [, lx0, ly0] = corridorPath(sx, sy, tx, ty, fromSide, toSide, corridor);

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
      // Distance from the line the label belongs to. Without this the search
      // treats a free slot 200 units away as perfect, and the label ends up
      // floating in empty space with no arrow near it — which reads as a bug,
      // not as tidiness. A label touching its own line is always better.
      c += (Math.abs(x - lx0) + Math.abs(y - ly0)) * 4;
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
      // Cap the search radius. It used to run to 22 steps of 11 units, so a
      // label could be relocated 242 units from its own edge; at the 0.4-0.6
      // zoom these diagrams render at, that is a caption stranded in the void.
      outer: for (let step = 1; step <= 6; step++) {
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
