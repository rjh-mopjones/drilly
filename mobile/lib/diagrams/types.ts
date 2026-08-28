/**
 * Data model for the interactive architecture diagrams.
 *
 * A diagram is data, not drawing: nodes carry their own explanation, so the
 * renderer (components/ArchDiagram.web.tsx) stays generic and adding a new
 * question means writing a spec here rather than hand-authoring SVG.
 *
 * Positions are in an arbitrary grid space; React Flow fits them to the
 * viewport, so only the relative layout matters.
 */

/**
 * What a box IS, not just how it looks. The kind picks the hue, the motif drawn
 * inside the box and the type tag in its top-right corner, so a reader can tell
 * a queue from a database without reading the label.
 *
 * The claim a kind makes is about deployment, which is why `process` exists: a
 * stage of one request path is not a thing you deploy, and drawing it as a peer
 * `service` says it is. A `process` may only appear inside a `serviceGroup`.
 *
 * Geometry note: every kind renders inside the same bounding rectangle. The
 * motifs are drawn within it rather than changing the outline, because
 * spaceColumns() and placeLabels() measure box rectangles and a real cylinder
 * or hexagon would silently break both.
 */
export type NodeKind =
  // --- things you deploy or depend on ---
  | "service" // one deployable unit of stateless compute
  | "process" // a stage INSIDE a service; never stands alone
  | "queue" // durable log, topic, work queue
  | "database" // durable system of record
  | "cache" // in-memory store you are allowed to lose
  | "blob" // object storage: S3, GCS, HDFS
  | "gateway" // load balancer, API gateway, CDN edge
  | "client" // the thing a person is holding
  | "external" // outside our trust boundary and our pager
  // --- frames: containers, not components ---
  | "serviceGroup" // one service made of several processes
  | "zone"; // a boundary; things that belong together but deploy apart

/** Frames contain other nodes and are sized rather than laid out. */
export const FRAME_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>([
  "serviceGroup",
  "zone",
]);

export function isFrame(kind: NodeKind): boolean {
  return FRAME_KINDS.has(kind);
}

/**
 * Why this particular technology, in the same shape as the "Key decisions"
 * micro-schema used across patterns.md: what was picked, what it was picked
 * over, the measurable thing that decided it, and when the alternative wins.
 */
export interface TechChoice {
  /** What is actually deployed here. */
  pick: string;
  /** The credible alternative, stated fairly. */
  instead: string;
  /** The number or property that settles it. */
  decider: string;
  /** Conditions under which you would pick the alternative instead. */
  flips: string;
}

export interface DiagramNodeDetail {
  /** One line: what this component is. */
  what: string;
  /** Why it exists at all; the design pressure it answers. */
  why: string;
  /** Concrete figures worth quoting in an interview. */
  numbers?: string[];
  /** The failure this component owns. */
  breaks?: string;
  /** Why this technology rather than the obvious alternative. */
  choice?: TechChoice;
}

export interface DiagramNode {
  id: string;
  label: string;
  /** Second line inside the box: the implementation choice. */
  sub?: string;
  kind: NodeKind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  detail?: DiagramNodeDetail;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** Dashed = control/metadata path rather than the main data path. */
  dashed?: boolean;
  /** Animated = the hot path the system spends its time on. */
  animated?: boolean;
  /** How far the orthogonal route stands off from the node, in px. */
  offset?: number;
  /** Every edge is clickable; this is what it says when you click it. */
  detail?: DiagramNodeDetail;
  /** Anchor overrides when the default top/bottom routing reads badly. */
  fromSide?: "top" | "right" | "bottom" | "left";
  toSide?: "top" | "right" | "bottom" | "left";
}

export interface DiagramOverview {
  /** The one-sentence shape of the system. */
  shape: string;
  /** Ordered walk through the design, one beat per paragraph. */
  beats: string[];
  /** The single hardest thing, stated plainly. */
  crux: string;
  numbers?: string[];
}

export interface Diagram {
  id: string;
  title: string;
  /** The question this diagram answers, worded exactly as in the source. */
  question: string;
  overview: DiagramOverview;
  /** Deep link back to the question this diagram belongs to. */
  sourceId: string;
  itemId: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}
