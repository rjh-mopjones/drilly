/**
 * Pure layout for the architecture diagrams: no React, no DOM.
 *
 * One pipeline, `layoutDiagram()`, used by BOTH the renderer and the gate, so
 * the picture on screen and the numbers in the checker cannot drift. It does
 * four things, in order:
 *
 *  1. collapse   — a serviceGroup becomes one box unless `expanded`; its
 *                  processes turn into a pipeline for the panel.
 *  2. position   — grid cells (col/row) become rectangles; frames are sized
 *                  from their members. Specs still on pixel x/y fall back to
 *                  the older column spacer.
 *  3. route      — every edge is routed on an orthogonal lane grid by a
 *                  shortest-path search that forbids overlap and touching,
 *                  charges heavily for crossings, then rips up and re-routes
 *                  until crossings stop falling. A long way round is cheap;
 *                  two lines crossing is not.
 *  4. label      — hot edges get a label slot on their own line that avoids
 *                  boxes, other labels and other lines.
 *
 * The result carries diagnostics (zoom, crossings, box hits) because those
 * are what "readable" means, and the gate fails on them.
 */
import type { Diagram, DiagramEdge, DiagramNode, EdgeTier } from "./types";
import { isFrame } from "./types";

// --- measured geometry ------------------------------------------------------
export const BOX_W = 200;
export const BOX_H = 60;
export const COL_PITCH = 340; // BOX_W + 140 gutter
export const ROW_PITCH = 160; // BOX_H + 100 gap
export const ORIGIN = 40;
export const LANE = 20; // spacing between parallel lanes
export const CLEARANCE = 16; // a route never comes closer than this to a box
export const STUB = 16; // perpendicular run out of a port before any turn
export const FRAME_PAD = { top: 34, side: 18, bottom: 16 };
export const LABEL_H = 19;
export const LABEL_CHAR_W = 6.9;
export const LABEL_PAD = 14;
/** The canvas a diagram is designed for: a 1440 window minus the sidebar. */
export const CANVAS = { w: 1140, h: 760 };
export const MIN_ZOOM = 0.8;
export const MAX_BOXES = 12;
export const MAX_HOT = 8;
export const MAX_LABEL = 28;

// Legacy (pixel spec) constants, kept until every spec is on the grid.
export const MIN_GUTTER = 190;
export const MIN_ROW_GAP = 46;
export const DEFAULT_H = 84;
const COL_TOLERANCE = 60;
const ROW_TOLERANCE = 40;

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = [number, number];
export type Side = "top" | "right" | "bottom" | "left";

export interface PipelineStage {
  id: string;
  label: string;
  sub?: string;
  /** Labels of nodes outside the group this stage talks to. */
  talksTo: string[];
}

export interface Route {
  id: string;
  tier: EdgeTier;
  fromSide: Side;
  toSide: Side;
  points: Point[];
}

export interface Layout {
  /** The diagram after collapsing: this is what gets drawn. */
  diagram: Diagram;
  rects: Record<string, Rect>;
  routes: Record<string, Route>;
  /** Centre of each hot edge's label. */
  labels: Record<string, Point>;
  /** Collapsed serviceGroups and the pipeline each one hides. */
  pipelines: Record<string, PipelineStage[]>;
  collapsed: Set<string>;
  bounds: Rect;
  /** fitView zoom on the design canvas. */
  zoom: number;
  crossings: number;
  boxHits: number;
  onGrid: boolean;
}

export function tierOf(e: DiagramEdge): EdgeTier {
  return e.tier ?? (e.animated ? "hot" : e.dashed ? "control" : "data");
}

export function dirOf(side: Side): Point {
  switch (side) {
    case "top":
      return [0, -1];
    case "bottom":
      return [0, 1];
    case "left":
      return [-1, 0];
    default:
      return [1, 0];
  }
}

/** Rendered height of a legacy box: taller when it carries a sub-label. */
export function nodeH(n: DiagramNode): number {
  return n.h ?? (n.sub ? DEFAULT_H : 62);
}

function onGrid(d: Diagram): boolean {
  const boxes = d.nodes.filter((n) => !isFrame(n.kind));
  return boxes.length > 0 && boxes.every((n) => n.col != null && n.row != null);
}

// --- 1. collapse --------------------------------------------------------------

function legacyRect(n: DiagramNode): Rect {
  return { x: n.x ?? 0, y: n.y ?? 0, w: n.w ?? (isFrame(n.kind) ? 300 : 240), h: isFrame(n.kind) ? (n.h ?? 300) : nodeH(n) };
}

function contains(outer: Rect, inner: Rect, slack = 2): boolean {
  return (
    inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.w <= outer.x + outer.w + slack &&
    inner.y + inner.h <= outer.y + outer.h + slack
  );
}

/** Which frame a node belongs to: declared `parent`, else the smallest enclosing frame. */
export function parentOf(n: DiagramNode, d: Diagram): string | undefined {
  if (n.parent) return n.parent;
  if (onGrid(d)) return undefined;
  const r = legacyRect(n);
  let best: { id: string; area: number } | undefined;
  for (const f of d.nodes) {
    if (!isFrame(f.kind) || f.id === n.id) continue;
    const fr = legacyRect(f);
    if (!contains(fr, r)) continue;
    const area = fr.w * fr.h;
    if (!best || area < best.area) best = { id: f.id, area };
  }
  return best?.id;
}

export function collapseGroups(d: Diagram): {
  diagram: Diagram;
  pipelines: Record<string, PipelineStage[]>;
  collapsed: Set<string>;
} {
  const pipelines: Record<string, PipelineStage[]> = {};
  const collapsed = new Set<string>();
  const owner = new Map<string, string>();
  for (const n of d.nodes) {
    const p = parentOf(n, d);
    if (p) owner.set(n.id, p);
  }
  const label = (id: string) => d.nodes.find((n) => n.id === id)?.label ?? id;

  for (const g of d.nodes) {
    if (g.kind !== "serviceGroup" || g.expanded) continue;
    const stages = d.nodes.filter((n) => n.kind === "process" && owner.get(n.id) === g.id);
    if (!stages.length) continue;
    collapsed.add(g.id);
    const ids = new Set(stages.map((s) => s.id));
    const order = (a: DiagramNode, b: DiagramNode) =>
      (a.row ?? a.y ?? 0) - (b.row ?? b.y ?? 0) || (a.col ?? a.x ?? 0) - (b.col ?? b.x ?? 0);
    pipelines[g.id] = [...stages].sort(order).map((s) => ({
      id: s.id,
      label: s.label,
      sub: s.sub,
      talksTo: d.edges
        .filter((e) => (e.from === s.id && !ids.has(e.to)) || (e.to === s.id && !ids.has(e.from)))
        .map((e) => (e.from === s.id ? `→ ${label(e.to)}` : `← ${label(e.from)}`)),
    }));
  }
  if (!collapsed.size) return { diagram: d, pipelines, collapsed };

  const hidden = new Set(
    d.nodes.filter((n) => n.kind === "process" && collapsed.has(owner.get(n.id) ?? "")).map((n) => n.id),
  );
  const lift = (id: string) => (hidden.has(id) ? (owner.get(id) as string) : id);
  const rank: Record<EdgeTier, number> = { hot: 2, data: 1, control: 0 };
  const merged = new Map<string, DiagramEdge>();
  for (const e of d.edges) {
    const from = lift(e.from);
    const to = lift(e.to);
    if (from === to) continue; // internal to the group: lives in the pipeline
    const key = `${from}>${to}`;
    const tier = tierOf(e);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...e, from, to, tier });
    } else if (rank[tier] > rank[tierOf(prev)]) {
      merged.set(key, { ...e, from, to, tier });
    }
  }
  // A collapsed group is drawn where its first stage was, in legacy specs.
  const nodes = d.nodes
    .filter((n) => !hidden.has(n.id))
    .map((n) => {
      if (!collapsed.has(n.id) || n.col != null) return n;
      const first = pipelines[n.id][0];
      const s = d.nodes.find((x) => x.id === first.id);
      return { ...n, x: s?.x ?? n.x, y: s?.y ?? n.y, w: s?.w ?? 260, h: undefined };
    });
  return { diagram: { ...d, nodes, edges: [...merged.values()] }, pipelines, collapsed };
}

// --- 2. position --------------------------------------------------------------

/** Legacy: widen the authored grid so labels have room. Only for pixel specs. */
export function spaceColumns(d: Diagram): Diagram {
  const boxes = d.nodes.filter((n) => !isFrame(n.kind));
  if (boxes.length < 2) return d;
  const sorted = [...boxes].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  const cols: { xs: number[]; nodes: DiagramNode[] }[] = [];
  for (const n of sorted) {
    const last = cols[cols.length - 1];
    if (last && Math.abs((n.x ?? 0) - last.xs[0]) <= COL_TOLERANCE) {
      last.nodes.push(n);
      last.xs.push(n.x ?? 0);
    } else cols.push({ xs: [n.x ?? 0], nodes: [n] });
  }
  const moved = new Map<string, number>();
  let cursor = Math.min(...cols[0].xs);
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    const left = Math.min(...c.xs);
    const width = Math.max(...c.nodes.map((n) => n.w ?? 240));
    for (const n of c.nodes) moved.set(n.id, cursor + ((n.x ?? 0) - left));
    const next = cols[i + 1];
    if (next) cursor += width + Math.max(MIN_GUTTER, Math.min(...next.xs) - (left + width));
  }
  const rowsSorted = [...boxes].sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
  const rows: { ys: number[]; nodes: DiagramNode[] }[] = [];
  for (const n of rowsSorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs((n.y ?? 0) - last.ys[0]) <= ROW_TOLERANCE) {
      last.nodes.push(n);
      last.ys.push(n.y ?? 0);
    } else rows.push({ ys: [n.y ?? 0], nodes: [n] });
  }
  const movedY = new Map<string, number>();
  let vCursor = rows.length ? Math.min(...rows[0].ys) : 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const top = Math.min(...r.ys);
    const height = Math.max(...r.nodes.map((n) => n.h ?? DEFAULT_H));
    for (const n of r.nodes) movedY.set(n.id, vCursor + ((n.y ?? 0) - top));
    const next = rows[i + 1];
    if (next) vCursor += height + Math.max(MIN_ROW_GAP, Math.min(...next.ys) - (top + height));
  }
  const nodes = d.nodes.map((n) => {
    if (!isFrame(n.kind)) return { ...n, x: moved.get(n.id) ?? n.x, y: movedY.get(n.id) ?? n.y };
    const fr = legacyRect(n);
    const inside = boxes.filter((b) => contains(fr, legacyRect(b), 8));
    if (!inside.length) return n;
    const l = Math.min(...inside.map((b) => moved.get(b.id) ?? b.x ?? 0));
    const r = Math.max(...inside.map((b) => (moved.get(b.id) ?? b.x ?? 0) + (b.w ?? 240)));
    const tp = Math.min(...inside.map((b) => movedY.get(b.id) ?? b.y ?? 0));
    const bt = Math.max(...inside.map((b) => (movedY.get(b.id) ?? b.y ?? 0) + (b.h ?? DEFAULT_H)));
    const padL = Math.min(...inside.map((b) => b.x ?? 0)) - fr.x;
    const padT = Math.min(...inside.map((b) => b.y ?? 0)) - fr.y;
    return { ...n, x: l - padL, w: r - l + padL * 2, y: tp - padT, h: bt - tp + padT * 2 };
  });
  return { ...d, nodes };
}

/** Rectangles for every node. Frames are sized from their members (grid) or authored (legacy). */
export function positionNodes(d: Diagram): { rects: Record<string, Rect>; onGrid: boolean } {
  const rects: Record<string, Rect> = {};
  if (!onGrid(d)) {
    const spaced = spaceColumns(d);
    for (const n of spaced.nodes) rects[n.id] = legacyRect(n);
    return { rects, onGrid: false };
  }
  for (const n of d.nodes) {
    if (isFrame(n.kind)) continue;
    rects[n.id] = {
      x: ORIGIN + (n.col as number) * COL_PITCH,
      y: ORIGIN + (n.row as number) * ROW_PITCH,
      w: BOX_W,
      h: BOX_H,
    };
  }
  // Frames: innermost first, so an outer frame can wrap an inner one's header.
  const frames = d.nodes.filter((n) => isFrame(n.kind));
  const depth = (f: DiagramNode): number => {
    let k = 0;
    let p = f.parent;
    while (p) {
      k++;
      p = d.nodes.find((n) => n.id === p)?.parent;
    }
    return k;
  };
  for (const f of [...frames].sort((a, b) => depth(b) - depth(a))) {
    const members = d.nodes.filter((n) => n.parent === f.id && rects[n.id]);
    if (!members.length) {
      rects[f.id] = { x: ORIGIN + (f.col ?? 0) * COL_PITCH, y: ORIGIN + (f.row ?? 0) * ROW_PITCH, w: BOX_W, h: BOX_H };
      continue;
    }
    const l = Math.min(...members.map((m) => rects[m.id].x)) - FRAME_PAD.side;
    const r = Math.max(...members.map((m) => rects[m.id].x + rects[m.id].w)) + FRAME_PAD.side;
    const t = Math.min(...members.map((m) => rects[m.id].y)) - FRAME_PAD.top;
    const b = Math.max(...members.map((m) => rects[m.id].y + rects[m.id].h)) + FRAME_PAD.bottom;
    rects[f.id] = { x: l, y: t, w: r - l, h: b - t };
  }
  return { rects, onGrid: true };
}

// --- 3. route -----------------------------------------------------------------

type Face = { side: Side; slot: number };
const DIRS: Point[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const BEND = 30;
const CROSS = 1000;
const HEADER = 80;
const INF = Number.POSITIVE_INFINITY;

function slotsFor(r: Rect, side: Side, frame: boolean): number[] {
  const along = side === "top" || side === "bottom" ? r.w : r.h;
  const step = frame ? 40 : side === "top" || side === "bottom" ? 30 : 18;
  const max = along / 2 - (frame ? 40 : 22);
  const out = [0];
  for (let k = 1; k * step <= max; k++) out.push(-k * step, k * step);
  return out;
}

function portPoint(r: Rect, f: Face): Point {
  switch (f.side) {
    case "top":
      return [r.x + r.w / 2 + f.slot, r.y];
    case "bottom":
      return [r.x + r.w / 2 + f.slot, r.y + r.h];
    case "left":
      return [r.x, r.y + r.h / 2 + f.slot];
    default:
      return [r.x + r.w, r.y + r.h / 2 + f.slot];
  }
}

function segsCross(p: [Point, Point], q: [Point, Point]): boolean {
  const aH = Math.abs(p[0][1] - p[1][1]) < 0.5;
  const bH = Math.abs(q[0][1] - q[1][1]) < 0.5;
  if (aH === bH) return false;
  const h = aH ? p : q;
  const v = aH ? q : p;
  const hy = h[0][1];
  const hx1 = Math.min(h[0][0], h[1][0]);
  const hx2 = Math.max(h[0][0], h[1][0]);
  const vx = v[0][0];
  const vy1 = Math.min(v[0][1], v[1][1]);
  const vy2 = Math.max(v[0][1], v[1][1]);
  return vx > hx1 + 0.5 && vx < hx2 - 0.5 && hy > vy1 + 0.5 && hy < vy2 - 0.5;
}

function segments(points: Point[]): [Point, Point][] {
  const out: [Point, Point][] = [];
  for (let i = 0; i < points.length - 1; i++) out.push([points[i], points[i + 1]]);
  return out;
}

/** Number of pairwise crossings between two sets of routes (or within one). */
export function countCrossings(routes: Route[]): number {
  let n = 0;
  const segs = routes.map((r) => segments(r.points));
  for (let i = 0; i < routes.length; i++)
    for (let j = i + 1; j < routes.length; j++)
      for (const a of segs[i]) for (const b of segs[j]) if (segsCross(a, b)) n++;
  return n;
}

function segHitsRect(s: [Point, Point], r: Rect, pad: number): boolean {
  const lx = Math.min(s[0][0], s[1][0]);
  const hx = Math.max(s[0][0], s[1][0]);
  const ly = Math.min(s[0][1], s[1][1]);
  const hy = Math.max(s[0][1], s[1][1]);
  return lx < r.x + r.w + pad && hx > r.x - pad && ly < r.y + r.h + pad && hy > r.y - pad;
}

/** Routes running through or along a box that is not one of their endpoints. */
export function countBoxHits(routes: Route[], edges: DiagramEdge[], boxes: Record<string, Rect>): number {
  let n = 0;
  const byId = new Map(edges.map((e) => [e.id, e]));
  for (const r of routes) {
    const e = byId.get(r.id);
    if (!e) continue;
    for (const [id, box] of Object.entries(boxes)) {
      if (id === e.from || id === e.to) continue;
      if (segments(r.points).some((s) => segHitsRect(s, box, CLEARANCE - 4))) {
        n++;
        break;
      }
    }
  }
  return n;
}

class Router {
  xs: number[] = [];
  ys: number[] = [];
  xi = new Map<number, number>();
  yi = new Map<number, number>();
  nx = 0;
  ny = 0;
  blocked!: Uint8Array; // inside a box
  noH!: Uint8Array; // may only be crossed vertically (stub line beside a box)
  noV!: Uint8Array;
  penalty!: Float32Array; // frame headers etc
  /** Occupancy by committed routes: 0 free, 1 horizontal pass, 2 vertical pass, 3 corner/end. */
  occ!: Uint8Array;
  occBy!: Int16Array;
  used = new Map<string, Set<string>>(); // nodeId -> "side:slot"

  constructor(
    public boxes: Record<string, Rect>,
    public frames: Record<string, Rect>,
  ) {
    const xs = new Set<number>();
    const ys = new Set<number>();
    const all = { ...boxes, ...frames };
    const add = (set: Set<number>, v: number) => set.add(Math.round(v));
    for (const r of Object.values(boxes)) {
      add(xs, r.x - STUB);
      add(xs, r.x + r.w + STUB);
      add(ys, r.y - STUB);
      add(ys, r.y + r.h + STUB);
    }
    for (const [id, r] of Object.entries(all)) {
      const frame = !!frames[id];
      for (const side of ["top", "left"] as Side[]) {
        for (const slot of slotsFor(r, side, frame)) {
          const p = portPoint(r, { side, slot });
          if (side === "top") add(xs, p[0]);
          else add(ys, p[1]);
        }
      }
      if (frame) {
        add(xs, r.x - STUB);
        add(xs, r.x + r.w + STUB);
        add(ys, r.y - STUB);
        add(ys, r.y + r.h + STUB);
      }
    }
    // Lanes in every gap between column clusters and row clusters, and margins.
    const rects = Object.values(boxes);
    const lanesBetween = (lo: number, hi: number, set: Set<number>) => {
      const mid = (lo + hi) / 2;
      const room = (hi - lo) / 2 - CLEARANCE - 8;
      add(set, mid);
      for (let k = 1; k * LANE <= room; k++) {
        add(set, mid - k * LANE);
        add(set, mid + k * LANE);
      }
    };
    const clusters = (lo: (r: Rect) => number, hi: (r: Rect) => number) => {
      const iv = rects.map((r) => [lo(r), hi(r)] as [number, number]).sort((a, b) => a[0] - b[0]);
      const out: [number, number][] = [];
      for (const [a, b] of iv) {
        const last = out[out.length - 1];
        if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
        else out.push([a, b]);
      }
      return out;
    };
    const cols = clusters((r) => r.x, (r) => r.x + r.w);
    const rows = clusters((r) => r.y, (r) => r.y + r.h);
    for (let i = 0; i + 1 < cols.length; i++) lanesBetween(cols[i][1], cols[i + 1][0], xs);
    for (let i = 0; i + 1 < rows.length; i++) lanesBetween(rows[i][1], rows[i + 1][0], ys);
    const bl = Math.min(...Object.values(all).map((r) => r.x));
    const br = Math.max(...Object.values(all).map((r) => r.x + r.w));
    const bt = Math.min(...Object.values(all).map((r) => r.y));
    const bb = Math.max(...Object.values(all).map((r) => r.y + r.h));
    for (let k = 0; k < 4; k++) {
      add(xs, bl - 30 - k * LANE);
      add(xs, br + 30 + k * LANE);
      add(ys, bt - 30 - k * LANE);
      add(ys, bb + 30 + k * LANE);
    }
    this.xs = [...xs].sort((a, b) => a - b);
    this.ys = [...ys].sort((a, b) => a - b);
    this.xs.forEach((v, i) => this.xi.set(v, i));
    this.ys.forEach((v, i) => this.yi.set(v, i));
    this.nx = this.xs.length;
    this.ny = this.ys.length;
    const N = this.nx * this.ny;
    this.blocked = new Uint8Array(N);
    this.noH = new Uint8Array(N);
    this.noV = new Uint8Array(N);
    this.penalty = new Float32Array(N);
    this.occ = new Uint8Array(N);
    this.occBy = new Int16Array(N).fill(-1);
    for (let i = 0; i < this.nx; i++)
      for (let j = 0; j < this.ny; j++) {
        const x = this.xs[i];
        const y = this.ys[j];
        const k = this.idx(i, j);
        for (const r of rects) {
          const pad = CLEARANCE - 1;
          if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) this.blocked[k] = 1;
          // Stub lines: only perpendicular traffic beside a box, never along it.
          const alongX = x >= r.x - 8 && x <= r.x + r.w + 8;
          const alongY = y >= r.y - 8 && y <= r.y + r.h + 8;
          if (alongX && (Math.abs(y - (r.y - STUB)) < 0.5 || Math.abs(y - (r.y + r.h + STUB)) < 0.5)) this.noH[k] = 1;
          if (alongY && (Math.abs(x - (r.x - STUB)) < 0.5 || Math.abs(x - (r.x + r.w + STUB)) < 0.5)) this.noV[k] = 1;
        }
        for (const f of Object.values(frames)) {
          if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + FRAME_PAD.top) this.penalty[k] += HEADER;
        }
      }
  }

  idx(i: number, j: number): number {
    return i * this.ny + j;
  }

  private stubNode(r: Rect, f: Face): number | null {
    const p = portPoint(r, f);
    const d = dirOf(f.side);
    const i = this.xi.get(Math.round(p[0] + d[0] * STUB));
    const j = this.yi.get(Math.round(p[1] + d[1] * STUB));
    if (i == null || j == null) return null;
    return this.idx(i, j);
  }

  private faces(id: string, r: Rect, frame: boolean, prefer?: Side): { f: Face; node: number; bonus: number }[] {
    const used = this.used.get(id) ?? new Set<string>();
    const out: { f: Face; node: number; bonus: number }[] = [];
    for (const side of ["top", "right", "bottom", "left"] as Side[]) {
      for (const slot of slotsFor(r, side, frame)) {
        if (used.has(`${side}:${slot}`)) continue;
        const node = this.stubNode(r, { side, slot });
        if (node == null || this.blocked[node]) continue;
        // Centre slots first; an authored side is a preference, not an order.
        out.push({ f: { side, slot }, node, bonus: (prefer === side ? -25 : 0) + Math.abs(slot) * 0.3 });
      }
    }
    return out;
  }

  /**
   * Shortest orthogonal path from any free port of `a` to any free port of
   * `b`. State is (grid node, heading) so bends can be charged. Overlapping or
   * touching a committed route is impossible, crossing one is merely very
   * expensive, and a frame header costs a little so lines go round names.
   */
  route(
    e: DiagramEdge,
    a: { id: string; r: Rect; frame: boolean },
    b: { id: string; r: Rect; frame: boolean },
    routeIndex: number,
  ): { from: Face; to: Face; points: Point[]; cost: number } | null {
    const starts = this.faces(a.id, a.r, a.frame, e.fromSide);
    const ends = this.faces(b.id, b.r, b.frame, e.toSide);
    if (!starts.length || !ends.length) return null;
    const endAt = new Map<number, { f: Face; dir: number; bonus: number }>();
    for (const t of ends) {
      const d = dirOf(t.f.side);
      // arriving means moving opposite to the face normal
      const dir = DIRS.findIndex((v) => v[0] === -d[0] && v[1] === -d[1]);
      const prev = endAt.get(t.node);
      if (!prev || t.bonus < prev.bonus) endAt.set(t.node, { f: t.f, dir, bonus: t.bonus });
    }
    const N = this.nx * this.ny;
    const dist = new Float64Array(N * 4).fill(INF);
    const prev = new Int32Array(N * 4).fill(-1);
    const startFace = new Map<number, Face>();
    // binary heap
    const heap: number[] = [];
    const hcost: number[] = [];
    const push = (s: number, c: number) => {
      heap.push(s);
      hcost.push(c);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hcost[p] <= hcost[i]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        [hcost[p], hcost[i]] = [hcost[i], hcost[p]];
        i = p;
      }
    };
    const pop = (): [number, number] => {
      const s = heap[0];
      const c = hcost[0];
      const ls = heap.pop() as number;
      const lc = hcost.pop() as number;
      if (heap.length) {
        heap[0] = ls;
        hcost[0] = lc;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && hcost[l] < hcost[m]) m = l;
          if (r < heap.length && hcost[r] < hcost[m]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          [hcost[m], hcost[i]] = [hcost[i], hcost[m]];
          i = m;
        }
      }
      return [s, c];
    };
    for (const s of starts) {
      const d = dirOf(s.f.side);
      const dir = DIRS.findIndex((v) => v[0] === d[0] && v[1] === d[1]);
      const st = s.node * 4 + dir;
      if (s.bonus + 30 < dist[st]) {
        dist[st] = s.bonus + 30;
        startFace.set(s.node, s.f);
        push(st, dist[st]);
      }
    }
    let goal = -1;
    while (heap.length) {
      const [st, c] = pop();
      if (c > dist[st]) continue;
      const node = st >> 2;
      const dir = st & 3;
      const end = endAt.get(node);
      if (end && end.dir === dir) {
        goal = st;
        break;
      }
      const i = Math.floor(node / this.ny);
      const j = node % this.ny;
      for (let nd = 0; nd < 4; nd++) {
        if ((nd + 2) % 4 === dir) continue; // no U-turns
        const ni = i + DIRS[nd][0];
        const nj = j + DIRS[nd][1];
        if (ni < 0 || nj < 0 || ni >= this.nx || nj >= this.ny) continue;
        const nn = this.idx(ni, nj);
        if (this.blocked[nn]) continue;
        const horizontal = nd === 0 || nd === 2;
        // Stub lines beside a box: perpendicular traffic only.
        if (horizontal && (this.noH[node] || this.noH[nn])) continue;
        if (!horizontal && (this.noV[node] || this.noV[nn])) continue;
        // Committed routes: never overlap, never touch a corner, cross at a price.
        const o = this.occ[nn];
        let extra = 0;
        if (o === 3) continue;
        if (o === 1 && horizontal) continue;
        if (o === 2 && !horizontal) continue;
        if (o !== 0) {
          // A crossing costs; turning ON another line's node would be a touch.
          extra += CROSS;
        }
        const step = Math.abs(horizontal ? this.xs[ni] - this.xs[i] : this.ys[nj] - this.ys[j]);
        const bend = nd === dir ? 0 : BEND;
        // Do not turn on a node another route passes through.
        if (o !== 0 && this.occ[node] !== 0 && nd !== dir) continue;
        const nc = c + step + bend + extra + this.penalty[nn];
        const ns = nn * 4 + nd;
        if (nc < dist[ns]) {
          dist[ns] = nc;
          prev[ns] = st;
          push(ns, nc);
        }
      }
    }
    if (goal < 0) return null;
    // walk back
    const nodes: number[] = [];
    let cur = goal;
    while (cur >= 0) {
      nodes.push(cur >> 2);
      cur = prev[cur];
    }
    nodes.reverse();
    // A turn onto the goal node is also a touch if occupied; guard.
    const pts: Point[] = nodes.map((n) => [this.xs[Math.floor(n / this.ny)], this.ys[n % this.ny]]);
    const from = startFace.get(nodes[0]) as Face;
    const to = (endAt.get(nodes[nodes.length - 1]) as { f: Face }).f;
    const points: Point[] = [portPoint(a.r, from), ...pts, portPoint(b.r, to)];
    return { from, to, points: simplify(points), cost: dist[goal] };
  }

  commit(id: string, aId: string, bId: string, res: { from: Face; to: Face; points: Point[] }, index: number) {
    const mark = (id: string, f: Face) => {
      const s = this.used.get(id) ?? new Set<string>();
      s.add(`${f.side}:${f.slot}`);
      this.used.set(id, s);
    };
    mark(aId, res.from);
    mark(bId, res.to);
    this.stamp(res.points, index, true);
  }

  release(aId: string, bId: string, res: { from: Face; to: Face; points: Point[] }, index: number) {
    this.used.get(aId)?.delete(`${res.from.side}:${res.from.slot}`);
    this.used.get(bId)?.delete(`${res.to.side}:${res.to.slot}`);
    this.stamp(res.points, index, false);
  }

  /** Mark every grid node a route passes through, by orientation. */
  private stamp(points: Point[], index: number, on: boolean) {
    // interior points only (ports are on box faces, not grid nodes)
    const inner = points.slice(1, -1);
    for (let s = 0; s < inner.length - 1; s++) {
      const [x1, y1] = inner[s];
      const [x2, y2] = inner[s + 1];
      const horizontal = Math.abs(y1 - y2) < 0.5;
      if (horizontal) {
        const j = this.yi.get(Math.round(y1));
        if (j == null) continue;
        const i1 = this.xi.get(Math.round(Math.min(x1, x2)));
        const i2 = this.xi.get(Math.round(Math.max(x1, x2)));
        if (i1 == null || i2 == null) continue;
        for (let i = i1; i <= i2; i++) this.mark(this.idx(i, j), 1, index, on);
      } else {
        const i = this.xi.get(Math.round(x1));
        if (i == null) continue;
        const j1 = this.yi.get(Math.round(Math.min(y1, y2)));
        const j2 = this.yi.get(Math.round(Math.max(y1, y2)));
        if (j1 == null || j2 == null) continue;
        for (let j = j1; j <= j2; j++) this.mark(this.idx(i, j), 2, index, on);
      }
    }
    // corners and ends are untouchable
    for (let s = 0; s < inner.length; s++) {
      const i = this.xi.get(Math.round(inner[s][0]));
      const j = this.yi.get(Math.round(inner[s][1]));
      if (i == null || j == null) continue;
      const k = this.idx(i, j);
      if (on) {
        this.occ[k] = 3;
        this.occBy[k] = index;
      } else {
        this.occ[k] = 0;
        this.occBy[k] = -1;
      }
    }
  }

  private mark(k: number, kind: 1 | 2, index: number, on: boolean) {
    if (on) {
      this.occ[k] = this.occ[k] === 0 ? kind : 3;
      this.occBy[k] = index;
    } else if (this.occBy[k] === index) {
      this.occ[k] = 0;
      this.occBy[k] = -1;
    }
  }
}

/** Drop collinear interior points. */
function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    if (b && Math.abs(b[0] - p[0]) < 0.5 && Math.abs(b[1] - p[1]) < 0.5) continue;
    if (a && b && ((Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - p[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - p[1]) < 0.5))) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

export function routeEdges(d: Diagram, rects: Record<string, Rect>): { routes: Record<string, Route>; crossings: number } {
  const boxes: Record<string, Rect> = {};
  const frames: Record<string, Rect> = {};
  for (const n of d.nodes) {
    if (!rects[n.id]) continue;
    if (isFrame(n.kind)) frames[n.id] = rects[n.id];
    else boxes[n.id] = rects[n.id];
  }
  const router = new Router(boxes, frames);
  const ends = (id: string) => (boxes[id] ? { id, r: boxes[id], frame: false } : frames[id] ? { id, r: frames[id], frame: true } : null);
  const rank: Record<EdgeTier, number> = { hot: 0, data: 1, control: 2 };
  const order = d.edges
    .filter((e) => ends(e.from) && ends(e.to) && e.from !== e.to)
    .map((e, i) => ({ e, i }))
    .sort((p, q) => {
      const t = rank[tierOf(p.e)] - rank[tierOf(q.e)];
      if (t) return t;
      const ra = rects[p.e.from];
      const rb = rects[p.e.to];
      const rc = rects[q.e.from];
      const rd = rects[q.e.to];
      const la = Math.abs(ra.x - rb.x) + Math.abs(ra.y - rb.y);
      const lb = Math.abs(rc.x - rd.x) + Math.abs(rc.y - rd.y);
      return la - lb;
    });
  const results = new Map<string, { from: Face; to: Face; points: Point[]; cost: number }>();
  const idx = new Map<string, number>();
  order.forEach((o, k) => idx.set(o.e.id, k));
  for (const { e } of order) {
    const a = ends(e.from) as { id: string; r: Rect; frame: boolean };
    const b = ends(e.to) as { id: string; r: Rect; frame: boolean };
    const res = router.route(e, a, b, idx.get(e.id) as number);
    if (!res) continue;
    results.set(e.id, res);
    router.commit(e.id, a.id, b.id, res, idx.get(e.id) as number);
  }
  const toRoutes = (): Record<string, Route> => {
    const out: Record<string, Route> = {};
    for (const { e } of order) {
      const r = results.get(e.id);
      if (!r) continue;
      out[e.id] = { id: e.id, tier: tierOf(e), fromSide: r.from.side, toSide: r.to.side, points: r.points };
    }
    return out;
  };
  // Rip up and re-route: each edge in turn is removed and routed again against
  // everything else, kept only if the total does not get worse.
  let best = countCrossings(Object.values(toRoutes()));
  for (let pass = 0; pass < 4 && best > 0; pass++) {
    let improved = false;
    for (const { e } of order) {
      const old = results.get(e.id);
      if (!old) continue;
      const a = ends(e.from) as { id: string; r: Rect; frame: boolean };
      const b = ends(e.to) as { id: string; r: Rect; frame: boolean };
      const k = idx.get(e.id) as number;
      router.release(a.id, b.id, old, k);
      const res = router.route(e, a, b, k);
      if (!res) {
        router.commit(e.id, a.id, b.id, old, k);
        continue;
      }
      results.set(e.id, res);
      const now = countCrossings(Object.values(toRoutes()));
      if (now <= best && (now < best || res.cost <= old.cost)) {
        router.commit(e.id, a.id, b.id, res, k);
        if (now < best) improved = true;
        best = now;
      } else {
        results.set(e.id, old);
        router.commit(e.id, a.id, b.id, old, k);
      }
    }
    if (!improved) break;
  }
  const routes = toRoutes();
  return { routes, crossings: countCrossings(Object.values(routes)) };
}

// --- 4. labels ------------------------------------------------------------------

export function labelWidth(text: string): number {
  return text.length * LABEL_CHAR_W + LABEL_PAD;
}

export function placeLabels(
  d: Diagram,
  rects: Record<string, Rect>,
  routes: Record<string, Route>,
  want: (e: DiagramEdge) => boolean,
): Record<string, Point> {
  const boxes = d.nodes.filter((n) => !isFrame(n.kind)).map((n) => rects[n.id]).filter(Boolean);
  const placed: Rect[] = [];
  const out: Record<string, Point> = {};
  const allSegs = Object.values(routes).map((r) => ({ id: r.id, segs: segments(r.points) }));
  const overlap = (a: Rect, b: Rect, pad = 0) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w + pad) - Math.max(a.x, b.x - pad)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h + pad) - Math.max(a.y, b.y - pad));
  const edges = d.edges.filter((e) => e.label && want(e) && routes[e.id]);
  edges.sort((a, b) => (a.label as string).length - (b.label as string).length);
  for (const e of edges) {
    const w = labelWidth(e.label as string);
    const pts = routes[e.id].points;
    const segs = segments(pts);
    const total = segs.reduce((s, [p, q]) => s + Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]), 0);
    // candidates: every 8 units along every run, plus perpendicular nudges
    const cands: { p: Point; along: number; seg: number }[] = [];
    let acc = 0;
    segs.forEach(([p, q], si) => {
      const len = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
      const steps = Math.max(1, Math.floor(len / 8));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        cands.push({ p: [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], along: acc + len * t, seg: si });
      }
      acc += len;
    });
    let best: { c: number; p: Point } | null = null;
    for (const cand of cands) {
      const [x, y] = cand.p;
      const r = { x: x - w / 2, y: y - LABEL_H / 2, w, h: LABEL_H };
      let c = 0;
      for (const b of boxes) c += overlap(r, b, 6) * 4;
      for (const q of placed) c += overlap(r, q, 4) * 3;
      // other lines under the label
      for (const o of allSegs) {
        if (o.id === e.id) continue;
        for (const s of o.segs) if (segHitsRect(s, r, 2)) c += 120;
      }
      // own line: the label should sit centred on a run, not on a corner
      const [p, q] = segs[cand.seg];
      const horiz = Math.abs(p[1] - q[1]) < 0.5;
      const runLen = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
      if (horiz && runLen < w) c += (w - runLen) * 0.5;
      // prefer the middle of the route
      c += Math.abs(cand.along - total / 2) * 0.05;
      if (!best || c < best.c) best = { c, p: cand.p };
    }
    if (!best) continue;
    out[e.id] = best.p;
    placed.push({ x: best.p[0] - w / 2, y: best.p[1] - LABEL_H / 2, w, h: LABEL_H });
  }
  return out;
}

// --- the pipeline -------------------------------------------------------------

export function layoutDiagram(authored: Diagram): Layout {
  const { diagram, pipelines, collapsed } = collapseGroups(authored);
  const { rects, onGrid: grid } = positionNodes(diagram);
  const { routes, crossings } = routeEdges(diagram, rects);
  const labels = placeLabels(diagram, rects, routes, (e) => tierOf(e) === "hot");
  const boxes: Record<string, Rect> = {};
  for (const n of diagram.nodes) if (!isFrame(n.kind) && rects[n.id]) boxes[n.id] = rects[n.id];
  const boxHits = countBoxHits(Object.values(routes), diagram.edges, boxes);

  let l = INF, t = INF, r = -INF, b = -INF;
  const grow = (x: number, y: number) => {
    l = Math.min(l, x);
    t = Math.min(t, y);
    r = Math.max(r, x);
    b = Math.max(b, y);
  };
  for (const rc of Object.values(rects)) {
    grow(rc.x, rc.y);
    grow(rc.x + rc.w, rc.y + rc.h);
  }
  for (const rt of Object.values(routes)) for (const p of rt.points) grow(p[0], p[1]);
  for (const [id, p] of Object.entries(labels)) {
    const w = labelWidth(diagram.edges.find((e) => e.id === id)?.label ?? "");
    grow(p[0] - w / 2, p[1] - LABEL_H / 2);
    grow(p[0] + w / 2, p[1] + LABEL_H / 2);
  }
  const bounds = { x: l, y: t, w: r - l, h: b - t };
  const zoom = Math.min(CANVAS.w / (bounds.w + 40), CANVAS.h / (bounds.h + 40));
  return { diagram, rects, routes, labels, pipelines, collapsed, bounds, zoom, crossings, boxHits, onGrid: grid };
}

/** SVG path with rounded corners for a route. */
export function routePath(points: Point[], radius = 9): string {
  if (!points.length) return "";
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const rad = Math.min(radius, inLen / 2, outLen / 2);
    if (rad < 1) {
      d += ` L ${cx},${cy}`;
      continue;
    }
    const iu = [(cx - px) / inLen, (cy - py) / inLen];
    const ou = [(nx - cx) / outLen, (ny - cy) / outLen];
    d += ` L ${cx - iu[0] * rad},${cy - iu[1] * rad}`;
    d += ` Q ${cx},${cy} ${cx + ou[0] * rad},${cy + ou[1] * rad}`;
  }
  const end = points[points.length - 1];
  d += ` L ${end[0]},${end[1]}`;
  return d;
}
