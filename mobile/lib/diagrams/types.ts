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

/** Visual role. Drives colour and border treatment, nothing else. */
export type NodeKind =
  | "bus" // durable log / message bus
  | "compute" // stateless worker tier
  | "store" // database, index, object store
  | "external" // outside our trust boundary
  | "group"; // background grouping box, non-interactive

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
