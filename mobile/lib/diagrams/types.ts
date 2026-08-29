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

/**
 * A figure with its explanation: the derivation where there is one and what
 * the number means for the design. The panel shows the value as a pill and
 * opens the explanation on tap. A bare string is a pill with nothing to tap.
 */
export type Figure = string | { value: string; explain: string };

export function figureValue(f: Figure): string {
  return typeof f === "string" ? f : f.value;
}

export function figureExplain(f: Figure): string | undefined {
  return typeof f === "string" ? undefined : f.explain;
}

/**
 * A failure and what the design does about it. `handled` names the mechanism
 * that contains the failure, or, when the design accepts it, what would have
 * to change to fix it and what that would cost. A bare string is unanswered.
 */
export type Breaks = string | { failure: string; handled: string };

export function breaksText(b: Breaks): string {
  return typeof b === "string" ? b : b.failure;
}

export function breaksHandled(b: Breaks): string | undefined {
  return typeof b === "string" ? undefined : b.handled;
}

export interface DiagramNodeDetail {
  /** One plain sentence: what this component is. */
  what: string;
  /** Why it exists at all; the design pressure it answers, then the mechanism. */
  why: string;
  /** Concrete figures, each with its derivation and meaning. */
  numbers?: Figure[];
  /** The failure this component owns, and how the design handles it. */
  breaks?: Breaks;
  /** Why this technology rather than the obvious alternative. */
  choice?: TechChoice;
}

export interface DiagramNode {
  id: string;
  label: string;
  /** Second line inside the box: the implementation choice. */
  sub?: string;
  kind: NodeKind;
  /**
   * Grid cell. The renderer owns the pitch, so a spec says WHERE a box sits in
   * the reading order and never how many pixels away it is. Frames omit these
   * and are sized from their members; a collapsed serviceGroup uses its own
   * cell for the single box it draws.
   */
  col?: number;
  row?: number;
  /** The frame this node sits inside, if any. */
  parent?: string;
  /** Legacy pixel position, used only by specs not yet on the grid. */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /**
   * A serviceGroup draws as ONE box by default and its processes become a
   * pipeline in the panel. Set this when the pipeline is the subject of the
   * diagram and has to be on the canvas (the rate limiter's gateway stages).
   */
  expanded?: boolean;
  detail?: DiagramNodeDetail;
}

/**
 * How much an edge matters to the reader, which decides how it is drawn.
 *
 *  - hot: the request path. Bold, accent, always labelled. At most 8.
 *  - data: a read or write that is not the hot path. Thin; label on hover or
 *    when an endpoint is selected.
 *  - control: configuration, invalidation, metrics. Thin and dashed; label on
 *    hover.
 *
 * Unset falls back to the older flags: animated => hot, dashed => control.
 */
export type EdgeTier = "hot" | "data" | "control";

export interface DiagramEdge {
  id: string;
  /**
   * A node id, or a FRAME id. An edge from a frame means "from every member":
   * three identical attempt-log edges from three workers are one edge from
   * their lane frame, which is both quieter and, for some K3,2 patterns, the
   * only way to draw the diagram without a crossing.
   */
  from: string;
  to: string;
  label?: string;
  tier?: EdgeTier;
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
  /**
   * Request-order ordinal, drawn as a badge on the label so the hot path reads
   * on the canvas before any tap. Only on `tier: "hot"` edges; 1..n contiguous.
   */
  step?: number;
}

/**
 * One step of the overview walk. `lights` names the nodes and edges the step is
 * about: the panel lights them and dims the rest, so the reader learns the
 * picture one mechanism at a time. A bare string is a beat that lights nothing.
 */
export type Beat = string | { text: string; lights: string[] };

export function beatText(b: Beat): string {
  return typeof b === "string" ? b : b.text;
}

export function beatLights(b: Beat): string[] {
  return typeof b === "string" ? [] : b.lights;
}

/** One constraint of the problem and the decision it forced; lights the box it produced. */
export interface Force {
  constraint: string;
  decision: string;
  lights: string[];
}

/** The design a reader arrives with, and the number at which it breaks. */
export interface Naive {
  text: string;
  lights: string[];
}

/** The hardest thing, and what the design does about it (or what would have to change). */
export type Crux = string | { problem: string; handled: string };

export function cruxText(c: Crux): string {
  return typeof c === "string" ? c : c.problem;
}

export function cruxHandled(c: Crux): string | undefined {
  return typeof c === "string" ? undefined : c.handled;
}

export interface DiagramOverview {
  /** The one-sentence shape of the system: the design's one idea. */
  shape: string;
  /** What forces what: 3-5 constraints and the decision each forced. */
  forces?: Force[];
  /** The obvious design and where it breaks. */
  naive?: Naive;
  /** Ordered walk through the design, one beat per paragraph. */
  beats: Beat[];
  /** The single hardest thing, and how the design handles it. */
  crux: Crux;
  numbers?: Figure[];
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
