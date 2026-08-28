/**
 * Compute a diagram's floorplan with ELK's layered algorithm.
 *
 * This replaced a dagre prototype. dagre laid the flow out correctly but its
 * compound-graph support is too weak for this vocabulary: a cluster's members
 * got spread across several ranks, so `serviceGroup` frames came out enormous
 * and mostly empty, and other edges then routed through the empty half — the
 * exact fault the hand-authored layouts had. Frames are load-bearing here (a
 * frame is a claim that these processes are ONE deployment), so the layout
 * engine has to treat them as real containers.
 *
 * ELK does. `hierarchyHandling: INCLUDE_CHILDREN` lays out across the hierarchy
 * while keeping each container compact and keeping non-members out of it.
 *
 * ELK is asynchronous, which is why this returns a promise and the renderer
 * holds the result in state.
 *
 * Membership is derived from the AUTHORED geometry, so no spec has to change:
 * whatever a frame enclosed before, it encloses now.
 */
import ELK from "elkjs/lib/elk.bundled.js";
import { isFrame, type Diagram, type DiagramNode } from "./types";

const DEFAULT_W = 240;
/** Matches nodeH() in layout.ts: box plus its type-tag row. */
const BOX_H = 84;
const NO_SUB_H = 62;

function sizeOf(n: DiagramNode): { w: number; h: number } {
  return { w: n.w ?? DEFAULT_W, h: n.h ?? (n.sub ? BOX_H : NO_SUB_H) };
}

/** Which frame, if any, the authored geometry says a node sits inside. */
function membership(d: Diagram): Map<string, string> {
  const frames = d.nodes.filter((n) => isFrame(n.kind));
  const owner = new Map<string, string>();
  const encloses = (f: DiagramNode, n: DiagramNode) => {
    const s = sizeOf(n);
    const fw = f.w ?? 300;
    const fh = f.h ?? 300;
    return (
      n.x >= f.x - 2 &&
      n.y >= f.y - 2 &&
      n.x + s.w <= f.x + fw + 2 &&
      n.y + s.h <= f.y + fh + 2
    );
  };
  for (const n of d.nodes) {
    let best: { id: string; area: number } | null = null;
    for (const f of frames) {
      if (f.id === n.id || !encloses(f, n)) continue;
      const area = (f.w ?? 300) * (f.h ?? 300);
      // Smallest enclosing frame wins, so a frame nested in a zone keeps its own.
      if (!best || area < best.area) best = { id: f.id, area };
    }
    if (best) owner.set(n.id, best.id);
  }
  return owner;
}

type ElkNode = {
  id: string;
  width?: number;
  height?: number;
  children?: ElkNode[];
  layoutOptions?: Record<string, string>;
  x?: number;
  y?: number;
};

let elk: InstanceType<typeof ELK> | null = null;
/** Built lazily: constructing ELK at module scope costs startup on every page. */
function getElk() {
  if (!elk) elk = new ELK();
  return elk;
}

export async function elkLayout(d: Diagram): Promise<Diagram> {
  const boxes = d.nodes.filter((n) => !isFrame(n.kind));
  if (boxes.length < 2) return d;

  const owner = membership(d);
  const byId = new Map(d.nodes.map((n) => [n.id, n] as const));

  const build = (parentId: string | null): ElkNode[] =>
    d.nodes
      .filter((n) => (owner.get(n.id) ?? null) === parentId)
      .map((n): ElkNode => {
        if (isFrame(n.kind)) {
          return {
            id: n.id,
            children: build(n.id),
            layoutOptions: {
              // Room for the frame's own header strip, which carries its name.
              "elk.padding": "[top=48,left=24,bottom=24,right=24]",
              "elk.algorithm": "layered",
              "elk.direction": "DOWN",
            },
          };
        }
        const s = sizeOf(n);
        // A client is where the reader starts, so pin it to the first layer.
        // Without this a response edge (a 429 going back to the caller) makes
        // the client a sink and ELK ranks it LAST, so the diagram reads
        // backwards: stores at the top, the caller at the bottom.
        return {
          id: n.id,
          width: s.w,
          height: s.h,
          ...(n.kind === "client"
            ? { layoutOptions: { "elk.layered.layering.layerConstraint": "FIRST" } }
            : {}),
        };
      });

  const graph: ElkNode & { edges: { id: string; sources: string[]; targets: string[] }[] } = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      // DOWN, not RIGHT. These graphs are 7-12 layers deep with 240-300px wide
      // boxes, so a left-to-right layout is a 2500px strip that fitView shrinks
      // until the text is unreadable.
      "elk.direction": "DOWN",
      // The whole reason for choosing ELK over dagre: lay out across the
      // hierarchy while keeping each container compact and exclusive.
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "110",
      "elk.spacing.nodeNode": "60",
      "elk.spacing.edgeNode": "30",
      "elk.spacing.edgeEdge": "22",
      // Crossings are the thing that makes these unreadable, so let ELK work
      // harder at them than the default.
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.thoroughness": "30",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: build(null),
    edges: d.edges
      .filter((e) => e.from !== e.to && byId.has(e.from) && byId.has(e.to))
      .map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
  };

  const res = (await getElk().layout(graph as never)) as unknown as ElkNode;

  // ELK reports each node's position relative to its parent; flatten to absolute.
  const abs = new Map<string, { x: number; y: number; w: number; h: number }>();
  const walk = (n: ElkNode, ox: number, oy: number) => {
    for (const c of n.children ?? []) {
      const x = ox + (c.x ?? 0);
      const y = oy + (c.y ?? 0);
      abs.set(c.id, { x, y, w: c.width ?? 0, h: c.height ?? 0 });
      walk(c, x, y);
    }
  };
  walk(res, 0, 0);

  const nodes = d.nodes.map((n) => {
    const p = abs.get(n.id);
    if (!p) return n;
    return isFrame(n.kind)
      ? { ...n, x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), h: Math.round(p.h) }
      : { ...n, x: Math.round(p.x), y: Math.round(p.y) };
  });

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  return {
    ...d,
    nodes: nodes.map((n) => ({ ...n, x: n.x - minX + 40, y: n.y - minY + 40 })),
  };
}
