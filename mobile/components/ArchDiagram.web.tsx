import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  MarkerType,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramNodeDetail,
  NodeKind,
  TechChoice,
} from "../lib/diagrams";
import { isFrame } from "../lib/diagrams";
import {
  DEFAULT_H,
  LABEL_CHAR_W,
  LABEL_H,
  MIN_GUTTER,
  MIN_ROW_GAP,
  anchor,
  assignLanes,
  corridorPath,
  nodeH,
  placeLabels,
  spaceColumns,
  type Lane,
} from "../lib/diagrams/layout";
import { MONO_FONT, UI_FONT, type Palette } from "../lib/theme";

/**
 * Interactive architecture diagram (web). The native app is a WebView shell
 * over the web build, so this renders on every surface; ArchDiagram.tsx is a
 * compile-time stub for the native bundle.
 *
 * Everything is clickable: boxes, the grouping zone, and every arrow. The
 * picture is the index; the panel is the content.
 */

const SIDE: Record<string, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | { kind: "overview" };

/**
 * What each kind looks like. A kind is a claim about what the thing IS, so it
 * drives three signals at once: the hue, a motif drawn inside the box, and the
 * type tag in the top-right corner. Together they let a reader tell a queue
 * from a database without reading a word.
 *
 * `hue` is a function of the palette so the same table serves light and dark.
 */
type KindStyle = {
  tag: string;
  hue: (p: Palette) => string;
  /** Cylinder rim across the top: stores. */
  rim?: boolean;
  /** Dashed strokes: you are allowed to lose it, or you do not own it. */
  dashed?: boolean;
  /** Motif drawn against the leading edge, and the padding it needs. */
  motif?: "bars" | "layers" | "chevron";
  /** Fully rounded: the only pill in the language. */
  pill?: boolean;
  /** A stage inside a service, drawn lighter and with no fill of its own. */
  faint?: boolean;
};

const KIND: Record<NodeKind, KindStyle> = {
  service: { tag: "SERVICE", hue: (p) => p.accent },
  process: { tag: "PROCESS", hue: (p) => p.accent, faint: true },
  queue: { tag: "QUEUE", hue: (p) => (p.scheme === "dark" ? "#c4b5fd" : "#6d28d9"), motif: "bars" },
  database: { tag: "DATABASE", hue: (p) => (p.scheme === "dark" ? "#86efac" : "#15803d"), rim: true },
  cache: { tag: "CACHE", hue: (p) => (p.scheme === "dark" ? "#fcd34d" : "#b45309"), rim: true, dashed: true },
  blob: { tag: "OBJECT STORE", hue: (p) => (p.scheme === "dark" ? "#67e8f9" : "#0e7490"), rim: true, motif: "layers" },
  gateway: { tag: "GATEWAY", hue: (p) => (p.scheme === "dark" ? "#5eead4" : "#0f766e"), motif: "chevron" },
  client: { tag: "CLIENT", hue: (p) => (p.scheme === "dark" ? "#94a3b8" : "#475569"), pill: true },
  external: { tag: "EXTERNAL", hue: (p) => (p.scheme === "dark" ? "#fda4af" : "#be123c"), dashed: true },
  // Frames render through their own components; these entries exist so the
  // record is total and a missing kind is a type error rather than a crash.
  serviceGroup: { tag: "SERVICE", hue: (p) => p.accent },
  zone: { tag: "", hue: (p) => p.border },
};

function kindColor(kind: NodeKind, p: Palette): string {
  return KIND[kind].hue(p);
}

/** Tint used for a box fill; stronger in dark, where a 7% wash vanishes. */
function tint(p: Palette): string {
  return p.scheme === "dark" ? "24" : "12";
}

/** The cylinder lip, drawn INSIDE the box so the bounding rect is unchanged. */
function Rim({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg
      width="100%"
      height="12"
      viewBox="0 0 100 12"
      preserveAspectRatio="none"
      style={{ position: "absolute", left: 0, top: 3, pointerEvents: "none" }}
      aria-hidden
    >
      <path
        d="M0 2 C 18 10, 82 10, 100 2"
        fill="none"
        stroke={color}
        strokeWidth={1.3}
        vectorEffect="non-scaling-stroke"
        strokeDasharray={dashed ? "6 3" : undefined}
      />
    </svg>
  );
}

/** Leading-edge motif. Queue = messages in line, blob = stacked layers. */
function Motif({ kind, color }: { kind: "bars" | "layers" | "chevron"; color: string }) {
  const base: React.CSSProperties = {
    position: "absolute",
    left: 13,
    pointerEvents: "none",
  };
  if (kind === "chevron") {
    return (
      <svg width="15" height="20" viewBox="0 0 15 20" style={{ ...base, bottom: 13 }} aria-hidden>
        <path d="M1 1 L13 10 L1 19" fill="none" stroke={color} strokeWidth={1.4} />
      </svg>
    );
  }
  const bars = kind === "bars";
  return (
    <div
      style={{
        ...base,
        bottom: 12,
        display: "flex",
        flexDirection: bars ? "row" : "column",
        gap: 3.5,
      }}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: bars ? 1.4 : 17,
            height: bars ? 24 : 1.4,
            background: color,
          }}
        />
      ))}
    </div>
  );
}

type NodeData = {
  node: DiagramNode;
  palette: Palette;
  selected: boolean;
  dimmed: boolean;
};

function BoxNode({ data }: NodeProps) {
  const { node, palette: p, selected, dimmed } = data as unknown as NodeData;
  const k = KIND[node.kind];
  const color = k.hue(p);
  const handles = ["top", "right", "bottom", "left"] as const;
  // A left-edge motif needs the text moved out of its way; nothing else does.
  const textPad = k.motif === "chevron" ? 20 : k.motif ? 24 : 0;

  return (
    <div
      style={{
        position: "relative",
        width: node.w ?? 240,
        boxSizing: "border-box",
        padding: "9px 14px 12px",
        borderRadius: k.pill ? 999 : 10,
        border: `${k.faint ? 1.2 : 1.5}px ${k.dashed ? "dashed" : "solid"} ${
          selected ? p.accent : color
        }`,
        background: selected
          ? p.surfacePressed
          : k.faint
            ? "transparent"
            : `${color}${tint(p)}`,
        opacity: dimmed ? 0.32 : k.faint ? 0.88 : 1,
        transition: "opacity 140ms ease, border-color 140ms ease, background 140ms ease",
        cursor: "pointer",
        fontFamily: UI_FONT,
        boxShadow: selected ? `0 0 0 3px ${p.accent}33` : "none",
      }}
    >
      {handles.map((h) => (
        <Handle
          key={`t-${h}`}
          type="target"
          id={h}
          position={SIDE[h]}
          style={{ opacity: 0, pointerEvents: "none" }}
        />
      ))}
      {handles.map((h) => (
        <Handle
          key={`s-${h}`}
          type="source"
          id={h}
          position={SIDE[h]}
          style={{ opacity: 0, pointerEvents: "none" }}
        />
      ))}

      {k.rim ? <Rim color={color} dashed={k.dashed} /> : null}
      {k.motif ? <Motif kind={k.motif} color={color} /> : null}

      {/* Type tag: its own row, so a rim or a long label never collides with it. */}
      <div
        style={{
          height: 12,
          marginBottom: 5,
          textAlign: "right",
          fontFamily: MONO_FONT,
          fontSize: 8.5,
          letterSpacing: "0.1em",
          lineHeight: "12px",
          color,
          opacity: k.faint ? 0.75 : 1,
        }}
      >
        {k.tag}
      </div>

      <div style={{ paddingLeft: textPad }}>
        <div style={{ color: p.textStrong, fontSize: 14.5, fontWeight: 600, lineHeight: 1.25 }}>
          {node.label}
        </div>
        {node.sub ? (
          <div style={{ color: p.textMuted, fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
            {node.sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A service that is made of several processes. Unlike a zone this is a claim
 * about deployment: one thing you ship, several stages inside it. It is what
 * stops four stages of one request path being drawn as four peer services.
 */
function ServiceGroupNode({ data }: NodeProps) {
  const { node, palette: p, selected, dimmed } = data as unknown as NodeData;
  const color = selected ? p.accent : p.accent;
  return (
    <div
      style={{
        width: node.w ?? 300,
        height: node.h ?? 300,
        boxSizing: "border-box",
        border: `1.5px solid ${color}`,
        borderRadius: 14,
        background: `${p.accent}${p.scheme === "dark" ? "14" : "0a"}`,
        opacity: dimmed ? 0.4 : 1,
        // Click-through body so the processes inside stay reachable; the header
        // strip is what selects the service itself.
        pointerEvents: "none",
        fontFamily: UI_FONT,
        transition: "opacity 140ms ease, border-color 140ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          padding: "9px 14px 8px",
          borderBottom: `1px solid ${p.accent}44`,
          cursor: "pointer",
          pointerEvents: "all",
        }}
      >
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.09em",
            color: selected ? p.accent : p.textStrong,
          }}
        >
          {node.label.toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 8.5,
            letterSpacing: "0.1em",
            color: p.accent,
          }}
        >
          SERVICE
        </span>
      </div>
    </div>
  );
}

/** Grouping box. Clickable via its label chip; the body stays click-through. */
function ZoneNode({ data }: NodeProps) {
  const { node, palette: p, selected, dimmed } = data as unknown as NodeData;
  return (
    <div
      style={{
        width: node.w ?? 300,
        height: node.h ?? 300,
        boxSizing: "border-box",
        border: `1.2px dashed ${selected ? p.accent : p.border}`,
        borderRadius: 12,
        background: `${p.text}06`,
        opacity: dimmed ? 0.4 : 1,
        pointerEvents: "none",
        fontFamily: UI_FONT,
        transition: "opacity 140ms ease, border-color 140ms ease",
      }}
    >
      <span
        style={{
          display: "inline-block",
          margin: "-11px 0 0 14px",
          padding: "3px 9px",
          borderRadius: 999,
          border: `1px solid ${selected ? p.accent : p.border}`,
          background: p.surface,
          color: selected ? p.accent : p.textMuted,
          fontSize: 11.5,
          fontWeight: 700,
          cursor: "pointer",
          pointerEvents: "all",
        }}
      >
        {node.label}
      </span>
    </div>
  );
}

/**
 * Edge whose label is portalled into React Flow's label layer, which sits
 * ABOVE the node layer. The default label lives in the edge SVG underneath the
 * nodes, so any edge routing across a box loses its label entirely: the text is
 * drawn, just hidden. Spacing alone cannot fix that, because the collision is
 * with a node the edge passes over rather than with the gap it sits in.
 */
function LabelledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  data,
}: EdgeProps) {
  const d = (data ?? {}) as {
    offset?: number;
    fg?: string;
    bg?: string;
    border?: string;
    lx?: number;
    ly?: number;
    pick?: () => void;
    corridor?: number;
    srcShift?: number;
    dstShift?: number;
  };
  // Routed here rather than by getSmoothStepPath, which places its
  // perpendicular run at the midpoint between the two nodes and ignores its
  // own `offset` argument for a normal left-to-right pair — so every edge
  // crossing the same gap turned at the same coordinate and they stacked.
  const sideName = (p: Position) =>
    p === Position.Left ? "left" : p === Position.Right ? "right" : p === Position.Top ? "top" : "bottom";
  const fromSide = sideName(sourcePosition);
  const toSide = sideName(targetPosition);
  const srcH = fromSide === "left" || fromSide === "right";
  const dstH = toSide === "left" || toSide === "right";
  // A shift slides the attachment ALONG the face, so it moves the axis the
  // face does not point down.
  const sx = srcH ? sourceX : sourceX + (d.srcShift ?? 0);
  const sy = srcH ? sourceY + (d.srcShift ?? 0) : sourceY;
  const tx = dstH ? targetX : targetX + (d.dstShift ?? 0);
  const ty = dstH ? targetY + (d.dstShift ?? 0) : targetY;
  const corridor = d.corridor ?? (srcH ? (sx + tx) / 2 : (sy + ty) / 2);
  const [path, labelX, labelY] = corridorPath(sx, sy, tx, ty, fromSide, toSide, corridor);
  // Label placement is resolved centrally in ArchDiagram (see placeLabels) so
  // labels can be deconflicted against boxes AND against each other; an edge
  // cannot do that alone because it cannot see its neighbours.
  const lx = d.lx ?? labelX;
  const ly = d.ly ?? labelY;

  return (
    <>
      {/*
        interactionWidth 0 on purpose. A 26px invisible path per edge means the
        edge drawn last wins any overlap, regardless of which line the pointer
        was nearest, and edges that pass under a box are unreachable entirely.
        Dropping it lets the click fall through to the pane, where
        nearestEdgeId() picks by distance instead of by paint order.
      */}
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={0} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
              padding: "2px 6px",
              borderRadius: 4,
              background: d.bg,
              border: `1px solid ${d.border}`,
              color: d.fg,
              fontFamily: UI_FONT,
              fontSize: 11.5,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const NODE_TYPES = { box: BoxNode, zone: ZoneNode, serviceGroup: ServiceGroupNode };
const EDGE_TYPES = { labelled: LabelledEdge };

/**
 * React Flow emits .react-flow__edgelabel-renderer BEFORE .react-flow__nodes in
 * the DOM and leaves both at `z-index: auto`, so paint order alone puts edge
 * labels underneath every node. Lift the label layer so a label on an edge that
 * routes across a box stays readable.
 */
const LABEL_LAYER_CSS = [
  ".react-flow__edgelabel-renderer { z-index: 6; }",
  // Frames must be click-through, and setting pointerEvents on the component's
  // own div is NOT enough: React Flow wraps every custom node in its own
  // .react-flow__node element, and that wrapper keeps pointer events. A frame
  // spans a large area, so the wrapper silently swallows every click aimed at a
  // box or an arrow inside it. Measured on web-crawler, whose two service frames
  // and one zone made 13 of its 22 arrows unclickable while none of them were
  // actually drawn underneath anything.
  //
  // The header strip and the zone chip re-enable pointer events on themselves,
  // so a frame is still selectable by its own title.
  // !important is required: React Flow ships `.react-flow__node { pointer-events:
  // all }` at the same specificity and its stylesheet wins on order.
  ".react-flow__node-zone, .react-flow__node-serviceGroup { pointer-events: none !important; }",
  // ...but the title still has to be clickable, so the frame stays selectable.
  ".react-flow__node-zone > div > span, .react-flow__node-serviceGroup > div > div { pointer-events: all !important; }",
].join("\n");

/**
 * Re-space the authored grid so edge labels have room.
 *
 * Specs are authored on a loose grid and the horizontal gutter between columns
 * is routinely too small for the label sitting on the arrow between them. Edge
 * labels render in the SVG layer BELOW nodes, so an oversized label does not
 * push anything aside, it just disappears under the next box. Rather than
 * police that per spec, widen every gutter to a fixed minimum here: columns
 * keep their order and their contents, only the spacing changes.
 *
 * Group zones are repositioned to keep enclosing whatever they enclosed before.
 */
// MINIMUMS, not fixed spacing. Forcing a fixed gutter blows up diagrams that
// already had several columns: the graph gets so wide that fitView shrinks the
// text to nothing. Authored spacing is kept wherever it is already generous
// enough for the label that sits in the gap.
/**
 * Which edge did that click mean?
 *
 * Fat invisible hit paths do not work here. Stacked in one layer they overlap,
 * and the one drawn last wins regardless of which line the pointer was actually
 * nearest — measured on the notification system, that left 4 of 18 edges
 * unselectable anywhere along their length. Distance is unambiguous where
 * stacking is not: sample every rendered path and take the closest one.
 *
 * Runs only on a pane click (a click that hit no node), so boxes still win where
 * a box is genuinely under the pointer.
 */
const HIT_RADIUS_PX = 16;

function nearestEdgeId(root: HTMLElement, cx: number, cy: number): string | null {
  let best: string | null = null;
  let bestD2 = HIT_RADIUS_PX * HIT_RADIUS_PX;

  for (const el of root.querySelectorAll<SVGPathElement>(".react-flow__edge-path")) {
    const id = el.closest(".react-flow__edge")?.getAttribute("data-id");
    if (!id) continue;
    const ctm = el.getScreenCTM();
    const svg = el.ownerSVGElement;
    if (!ctm || !svg) continue;

    const len = el.getTotalLength();
    if (!len) continue;
    // ~6px along the path is fine: we only need to beat HIT_RADIUS_PX.
    const steps = Math.min(400, Math.max(12, Math.ceil(len / 6)));
    const pt = svg.createSVGPoint();
    for (let i = 0; i <= steps; i++) {
      const q = el.getPointAtLength((len * i) / steps);
      pt.x = q.x;
      pt.y = q.y;
      const s = pt.matrixTransform(ctm);
      const dx = s.x - cx;
      const dy = s.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = id;
      }
    }
  }
  return best;
}


/** Width of a DOM node, tracked so the detail panel can reflow. */
function useWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}


/**
 * Decide where every edge label sits, in one place.
 *
 * Two collisions matter and neither can be solved by an edge on its own. A
 * label whose edge routes across a box covers that component's name, and two
 * labels landing in the same gap cover each other. Both are resolved here by
 * computing each label's rectangle up front, sliding it clear of any box, then
 * sliding it clear of labels already placed.
 */
export default function ArchDiagram({
  diagram: authored,
  palette,
}: {
  diagram: Diagram;
  palette: Palette;
}) {
  const diagram = useMemo(() => spaceColumns(authored), [authored]);
  const [sel, setSel] = useState<Selection | null>(null);

  const selNode = useMemo(
    () => (sel?.kind === "node" ? (diagram.nodes.find((n) => n.id === sel.id) ?? null) : null),
    [diagram, sel],
  );
  const selEdge = useMemo(
    () => (sel?.kind === "edge" ? (diagram.edges.find((e) => e.id === sel.id) ?? null) : null),
    [diagram, sel],
  );

  /** What stays lit: the selection and whatever it touches. */
  const lit = useMemo(() => {
    if (!sel || sel.kind === "overview") return null;
    const s = new Set<string>();
    if (sel.kind === "node") {
      s.add(sel.id);
      for (const e of diagram.edges) {
        if (e.from === sel.id) s.add(e.to);
        if (e.to === sel.id) s.add(e.from);
      }
    } else {
      const e = diagram.edges.find((x) => x.id === sel.id);
      if (e) {
        s.add(e.from);
        s.add(e.to);
      }
    }
    return s;
  }, [diagram, sel]);

  const nodes: Node[] = useMemo(
    () =>
      diagram.nodes.map((n) => ({
        id: n.id,
        type:
          n.kind === "zone" ? "zone" : n.kind === "serviceGroup" ? "serviceGroup" : "box",
        position: { x: n.x, y: n.y },
        draggable: false,
        selectable: true,
        zIndex: isFrame(n.kind) ? 0 : 1,
        data: {
          node: n,
          palette,
          selected: sel?.kind === "node" && sel.id === n.id,
          dimmed: !!lit && !lit.has(n.id),
        },
      })),
    [diagram, palette, sel, lit],
  );

  const selectEdge = useCallback((id: string) => {
    setSel((cur) => (cur?.kind === "edge" && cur.id === id ? null : { kind: "edge", id }));
  }, []);

  const labelPos = useMemo(() => placeLabels(diagram), [diagram]);
  const lanes = useMemo(() => assignLanes(diagram), [diagram]);

  const edges: Edge[] = useMemo(
    () =>
      diagram.edges.map((e) => {
        const isSel = sel?.kind === "edge" && sel.id === e.id;
        const dim = !!lit && !isSel && !(lit.has(e.from) && lit.has(e.to));
        const stroke = isSel
          ? palette.accent
          : dim
            ? palette.border
            : e.animated
              ? palette.accent
              : e.dashed
                ? palette.textMuted
                : palette.text;
        return {
          id: e.id,
          type: "labelled",
          data: {
            ...labelPos[e.id],
            pick: () => selectEdge(e.id),
            ...lanes[e.id],
            fg: isSel ? palette.accent : palette.textMuted,
            bg: palette.bg,
            border: palette.border,
          },
          source: e.from,
          target: e.to,
          // The router may pick a different face than the spec asked for when
          // the authored one would drive the edge through a box.
          sourceHandle: lanes[e.id]?.fromSide ?? e.fromSide ?? "bottom",
          targetHandle: lanes[e.id]?.toSide ?? e.toSide ?? "top",
          label: e.label,
          animated: !!e.animated && !dim,
          // Fat invisible hit area so thin arrows are still tappable.
          interactionWidth: 26,
          style: {
            stroke,
            strokeWidth: isSel ? 2.6 : 1.6,
            strokeDasharray: e.dashed ? "5 4" : undefined,
            opacity: dim ? 0.35 : 1,
            cursor: "pointer",
            transition: "opacity 140ms ease, stroke-width 140ms ease",
          },
          // Sized in FLOW units, which fitView then scales down: these diagrams
          // land at 0.35-0.65 zoom, so a 9px head renders at 3-6px and reads as
          // no arrowhead at all. That was the complaint. 20 flow units lands at
          // roughly 7-13px on screen, which is what the mockup showed.
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 20, height: 20 },
        };
      }),
    [diagram, palette, sel, lit, labelPos, lanes, selectEdge],
  );

  const onNodeClick = useCallback((_e: unknown, n: Node) => {
    setSel((cur) => (cur?.kind === "node" && cur.id === n.id ? null : { kind: "node", id: n.id }));
  }, []);
  const onEdgeClick = useCallback(
    (_e: unknown, ed: Edge) => selectEdge(ed.id),
    [selectEdge],
  );

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const width = useWidth(wrapRef);
  const narrow = width > 0 && width < 720;

  const maxX = useMemo(
    () => Math.max(...diagram.nodes.map((n) => n.x + (n.w ?? 240))),
    [diagram],
  );
  const anchorX = selNode ? selNode.x + (selNode.w ?? 240) / 2 : 0;
  const side: "left" | "right" = selNode && anchorX > maxX / 2 ? "left" : "right";

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: "100%", height: "100%", fontFamily: UI_FONT }}
    >
      <style>{LABEL_LAYER_CSS}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={(ev) => {
          // A click that reached the pane may still have been aimed at an arrow
          // that a box is sitting on top of. Ask which line was nearest first.
          const root = wrapRef.current;
          const id = root ? nearestEdgeId(root, ev.clientX, ev.clientY) : null;
          if (id) selectEdge(id);
          else setSel(null);
        }}
        fitView
        // 0.4 padding was covering label overhang back when labels routinely
        // sat outside the node bounds. placeLabels keeps them close now, and
        // 40% of the canvas spent on margin left the text too small to read on
        // a first look — which is the whole point of the diagram.
        fitViewOptions={{ padding: 0.14, maxZoom: 1.15 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={palette.border} />
        <Controls showInteractive={false} />
      </ReactFlow>

      <button
        onClick={() => setSel((c) => (c?.kind === "overview" ? null : { kind: "overview" }))}
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          padding: "8px 14px",
          borderRadius: 999,
          border: `1px solid ${sel?.kind === "overview" ? palette.accent : palette.border}`,
          background: sel?.kind === "overview" ? palette.surfacePressed : palette.surface,
          color: sel?.kind === "overview" ? palette.accent : palette.textStrong,
          fontFamily: UI_FONT,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Overview
      </button>

      {sel?.kind === "overview" ? (
        <OverviewPanel diagram={diagram} palette={palette} narrow={narrow} onClose={() => setSel(null)} />
      ) : selNode?.detail ? (
        <DetailPanel
          title={selNode.label}
          sub={selNode.sub}
          detail={selNode.detail}
          palette={palette}
          narrow={narrow}
          side={side}
          onClose={() => setSel(null)}
        />
      ) : selEdge?.detail ? (
        <DetailPanel
          title={edgeTitle(selEdge, diagram)}
          sub={selEdge.label}
          detail={selEdge.detail}
          palette={palette}
          narrow={narrow}
          side="right"
          onClose={() => setSel(null)}
        />
      ) : (
        <Hint palette={palette} />
      )}
    </div>
  );
}

function edgeTitle(e: DiagramEdge, d: Diagram): string {
  const name = (id: string) => d.nodes.find((n) => n.id === id)?.label ?? id;
  return `${name(e.from)} → ${name(e.to)}`;
}

function Hint({ palette: p }: { palette: Palette }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 12,
        padding: "8px 12px",
        borderRadius: 8,
        background: p.surface,
        border: `1px solid ${p.border}`,
        color: p.textMuted,
        fontFamily: UI_FONT,
        fontSize: 12.5,
        pointerEvents: "none",
      }}
    >
      Tap any box or arrow. Start with Overview.
    </div>
  );
}

function panelPlacement(narrow: boolean, side: "left" | "right"): React.CSSProperties {
  return narrow
    ? { left: 10, right: 10, bottom: 10, maxHeight: "52%" }
    : {
        top: 62,
        [side]: 12,
        width: "min(380px, calc(100% - 24px))",
        maxHeight: "calc(100% - 76px)",
      };
}

const panelChrome = (p: Palette): React.CSSProperties => ({
  position: "absolute",
  overflowY: "auto",
  padding: 16,
  borderRadius: 12,
  background: p.surface,
  border: `1px solid ${p.border}`,
  fontFamily: UI_FONT,
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
});

function PanelHeader({
  p,
  title,
  sub,
  onClose,
}: {
  p: Palette;
  title: string;
  sub?: string;
  onClose: () => void;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ color: p.textStrong, fontSize: 16, fontWeight: 700 }}>{title}</div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: "none",
            color: p.textMuted,
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
            fontFamily: UI_FONT,
          }}
        >
          ✕
        </button>
      </div>
      {sub ? <div style={{ color: p.accent, fontSize: 12.5, marginTop: 2 }}>{sub}</div> : null}
    </>
  );
}

function DetailPanel({
  title,
  sub,
  detail,
  palette: p,
  narrow,
  side,
  onClose,
}: {
  title: string;
  sub?: string;
  detail: DiagramNodeDetail;
  palette: Palette;
  narrow: boolean;
  side: "left" | "right";
  onClose: () => void;
}) {
  return (
    <div style={{ ...panelChrome(p), ...panelPlacement(narrow, side) }}>
      <PanelHeader p={p} title={title} sub={sub} onClose={onClose} />
      <Section p={p} title="What it is" body={detail.what} />
      <Section p={p} title="Why it exists" body={detail.why} />
      {detail.numbers?.length ? <Pills p={p} items={detail.numbers} /> : null}
      {detail.breaks ? <Section p={p} title="What breaks" body={detail.breaks} accent /> : null}
      {detail.choice ? <ChoiceBlock p={p} c={detail.choice} /> : null}
    </div>
  );
}

function OverviewPanel({
  diagram,
  palette: p,
  narrow,
  onClose,
}: {
  diagram: Diagram;
  palette: Palette;
  narrow: boolean;
  onClose: () => void;
}) {
  const o = diagram.overview;
  return (
    <div
      style={{
        ...panelChrome(p),
        ...(narrow
          ? { left: 10, right: 10, bottom: 10, maxHeight: "62%" }
          : {
              top: 62,
              left: 12,
              width: "min(440px, calc(100% - 24px))",
              maxHeight: "calc(100% - 76px)",
            }),
      }}
    >
      <PanelHeader p={p} title={diagram.title} sub={diagram.question} onClose={onClose} />
      <Section p={p} title="The shape of it" body={o.shape} />
      <Label p={p}>How it works</Label>
      {o.beats.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginTop: 9 }}>
          <div
            style={{
              flex: "0 0 auto",
              width: 20,
              height: 20,
              borderRadius: 999,
              border: `1px solid ${p.border}`,
              color: p.accent,
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {i + 1}
          </div>
          <div style={{ color: p.text, fontSize: 13.5, lineHeight: 1.55 }}>{b}</div>
        </div>
      ))}
      {o.numbers?.length ? <Pills p={p} items={o.numbers} /> : null}
      <Section p={p} title="The hard part" body={o.crux} accent />
    </div>
  );
}

/**
 * Technology rationale, in the same Choice / Alternative / Decider / flips
 * shape the written questions use. Boxed off so it reads as a decision rather
 * than more description.
 */
function ChoiceBlock({ p, c }: { p: Palette; c: TechChoice }) {
  const Row = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
    <div style={{ marginTop: 8 }}>
      <span style={{ color: p.textMuted, fontSize: 11.5, fontWeight: 700 }}>{k} </span>
      <span style={{ color: tone ?? p.text, fontSize: 13, lineHeight: 1.5 }}>{v}</span>
    </div>
  );
  return (
    <div
      style={{
        marginTop: 16,
        padding: "12px 13px",
        borderRadius: 10,
        border: `1px solid ${p.border}`,
        background: p.codeBg,
      }}
    >
      <div
        style={{
          color: p.accent,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontWeight: 700,
        }}
      >
        Why this technology
      </div>
      <Row k="Choice:" v={c.pick} tone={p.textStrong} />
      <Row k="Instead of:" v={c.instead} />
      <Row k="Decider:" v={c.decider} />
      <Row k="Alternative wins when:" v={c.flips} />
    </div>
  );
}

function Pills({ p, items }: { p: Palette; items: string[] }) {
  return (
    <>
      <Label p={p}>Numbers</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {items.map((n) => (
          <span
            key={n}
            style={{
              fontSize: 12,
              color: p.text,
              background: p.codeBg,
              border: `1px solid ${p.border}`,
              borderRadius: 999,
              padding: "3px 9px",
            }}
          >
            {n}
          </span>
        ))}
      </div>
    </>
  );
}

function Label({ p, children }: { p: Palette; children: React.ReactNode }) {
  return (
    <div
      style={{
        color: p.textMuted,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginTop: 14,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function Section({
  p,
  title,
  body,
  accent,
}: {
  p: Palette;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <>
      <Label p={p}>{title}</Label>
      <div
        style={{
          color: accent ? p.errorFg : p.text,
          fontSize: 13.5,
          lineHeight: 1.55,
          marginTop: 5,
        }}
      >
        {body}
      </div>
    </>
  );
}
