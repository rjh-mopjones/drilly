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
  layoutDiagram,
  routePath,
  tierOf,
  type Layout,
  type PipelineStage,
  type Point,
  type Rect,
} from "../lib/diagrams/layout";
import { MONO_FONT, UI_FONT, type Palette } from "../lib/theme";

/**
 * Interactive architecture diagram (web). The native app is a WebView shell
 * over the web build, so this renders on every surface; ArchDiagram.tsx is a
 * compile-time stub for the native bundle.
 *
 * Everything on the canvas comes from layoutDiagram() in lib/diagrams/layout:
 * which boxes are drawn (groups collapse), where they sit (grid cells), the
 * exact polyline of every arrow, and where hot-path labels go. This component
 * only paints and handles clicks. The gate uses the same function, so what
 * it measures is what you see.
 *
 * Reading hierarchy: hot edges are bold, accent and always labelled; data and
 * control edges are thin and unlabelled until you hover them or select one of
 * their endpoints. The picture is the index; the panel is the content.
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

/** What each kind looks like: hue, motif inside the box, and the type tag. */
type KindStyle = {
  tag: string;
  hue: (p: Palette) => string;
  rim?: boolean;
  dashed?: boolean;
  motif?: "bars" | "layers" | "chevron";
  pill?: boolean;
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
  serviceGroup: { tag: "SERVICE", hue: (p) => p.accent },
  zone: { tag: "", hue: (p) => p.border },
};

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
      style={{ position: "absolute", left: 0, top: 2, pointerEvents: "none" }}
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

function Motif({ kind, color }: { kind: "bars" | "layers" | "chevron"; color: string }) {
  const base: React.CSSProperties = { position: "absolute", left: 11, pointerEvents: "none" };
  if (kind === "chevron") {
    return (
      <svg width="12" height="22" viewBox="0 0 12 22" style={{ ...base, top: 20 }} aria-hidden>
        <path d="M1 1 L11 11 L1 21" fill="none" stroke={color} strokeWidth={1.4} />
      </svg>
    );
  }
  const bars = kind === "bars";
  return (
    <div style={{ ...base, top: 20, display: "flex", flexDirection: bars ? "row" : "column", gap: 3.5 }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: bars ? 1.4 : 15, height: bars ? 22 : 1.4, background: color }} />
      ))}
    </div>
  );
}

type NodeData = {
  node: DiagramNode;
  rect: Rect;
  palette: Palette;
  selected: boolean;
  dimmed: boolean;
  stages?: number;
};

function Handles() {
  const handles = ["top", "right", "bottom", "left"] as const;
  return (
    <>
      {handles.map((h) => (
        <Handle key={`t-${h}`} type="target" id={h} position={SIDE[h]} style={{ opacity: 0, pointerEvents: "none" }} />
      ))}
      {handles.map((h) => (
        <Handle key={`s-${h}`} type="source" id={h} position={SIDE[h]} style={{ opacity: 0, pointerEvents: "none" }} />
      ))}
    </>
  );
}

function BoxNode({ data }: NodeProps) {
  const { node, rect, palette: p, selected, dimmed, stages } = data as unknown as NodeData;
  const k = KIND[node.kind === "serviceGroup" ? "service" : node.kind];
  const color = k.hue(p);
  const textPad = k.motif === "chevron" ? 16 : k.motif ? 20 : 0;
  const tag = stages ? `${stages} STAGES · ${k.tag}` : k.tag;

  return (
    <div
      style={{
        position: "relative",
        width: rect.w,
        height: rect.h,
        boxSizing: "border-box",
        padding: "18px 11px 0",
        borderRadius: k.pill ? 999 : 9,
        border: `${k.faint ? 1.1 : 1.4}px ${k.dashed ? "dashed" : "solid"} ${selected ? p.accent : color}`,
        background: selected ? p.surfacePressed : k.faint ? "transparent" : `${color}${tint(p)}`,
        opacity: dimmed ? 0.32 : 1,
        transition: "opacity 140ms ease, border-color 140ms ease, background 140ms ease",
        cursor: "pointer",
        fontFamily: UI_FONT,
        boxShadow: selected ? `0 0 0 3px ${p.accent}33` : "none",
        overflow: "hidden",
      }}
    >
      <Handles />
      {k.rim ? <Rim color={color} dashed={k.dashed} /> : null}
      {k.motif ? <Motif kind={k.motif} color={color} /> : null}
      <div
        style={{
          position: "absolute",
          top: 5,
          right: 9,
          fontFamily: MONO_FONT,
          fontSize: 8,
          letterSpacing: "0.1em",
          lineHeight: "10px",
          color,
          opacity: k.faint ? 0.8 : 1,
        }}
      >
        {tag}
      </div>
      <div style={{ paddingLeft: textPad + (k.pill ? 6 : 0) }}>
        <div
          style={{
            color: p.textStrong,
            fontSize: 15,
            fontWeight: 600,
            lineHeight: "18px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.label}
        </div>
        {node.sub ? (
          <div
            style={{
              color: p.textMuted,
              fontSize: 12,
              marginTop: 1,
              lineHeight: "15px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {node.sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** An expanded service: one deployable made of several stages. */
function ServiceGroupNode({ data }: NodeProps) {
  const { node, rect, palette: p, selected, dimmed } = data as unknown as NodeData;
  return (
    <div
      style={{
        width: rect.w,
        height: rect.h,
        boxSizing: "border-box",
        border: `1.4px solid ${p.accent}`,
        borderRadius: 12,
        background: `${p.accent}${p.scheme === "dark" ? "12" : "08"}`,
        opacity: dimmed ? 0.4 : 1,
        pointerEvents: "none",
        fontFamily: UI_FONT,
        transition: "opacity 140ms ease, border-color 140ms ease",
      }}
    >
      <Handles />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          padding: "8px 14px 6px",
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
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.label.toUpperCase()}
        </span>
        <span style={{ fontFamily: MONO_FONT, fontSize: 8, letterSpacing: "0.1em", color: p.accent }}>
          {node.sub ? node.sub.toUpperCase() : "SERVICE"}
        </span>
      </div>
    </div>
  );
}

/** A boundary. Clickable via its label; the body stays click-through. */
function ZoneNode({ data }: NodeProps) {
  const { node, rect, palette: p, selected, dimmed } = data as unknown as NodeData;
  return (
    <div
      style={{
        width: rect.w,
        height: rect.h,
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
      <Handles />
      <span
        style={{
          display: "inline-block",
          margin: "8px 0 0 12px",
          padding: "2px 8px",
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

type EdgeData = {
  points: Point[];
  label?: string;
  showLabel: boolean;
  lx?: number;
  ly?: number;
  fg: string;
  bg: string;
  border: string;
  bold: boolean;
};

/** Where a label goes when the layout did not place one (hover labels). */
function longestRunMid(points: Point[]): Point {
  let best = { len: -1, p: points[0] ?? [0, 0] };
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > best.len) best = { len, p: [(x1 + x2) / 2, (y1 + y2) / 2] };
  }
  return best.p;
}

/**
 * Edge drawn from the layout's polyline. The label is portalled into React
 * Flow's label layer, which LABEL_LAYER_CSS lifts above the nodes.
 */
function RoutedEdge({ id, style, markerEnd, data }: EdgeProps) {
  const d = data as unknown as EdgeData;
  const path = useMemo(() => routePath(d.points), [d.points]);
  const [lx, ly] = d.lx != null && d.ly != null ? [d.lx, d.ly] : longestRunMid(d.points);
  return (
    <>
      {/* interactionWidth 0 on purpose: clicks resolve by distance in nearestEdgeId(). */}
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={0} />
      {d.label && d.showLabel ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
              padding: "1px 6px",
              borderRadius: 4,
              background: d.bg,
              border: `1px solid ${d.border}`,
              color: d.fg,
              fontFamily: UI_FONT,
              fontSize: 11.5,
              lineHeight: "15px",
              fontWeight: d.bold ? 600 : 400,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const NODE_TYPES = { box: BoxNode, zone: ZoneNode, serviceGroup: ServiceGroupNode };
const EDGE_TYPES = { routed: RoutedEdge };

/**
 * React Flow emits .react-flow__edgelabel-renderer BEFORE .react-flow__nodes and
 * leaves both at z-index auto, so labels paint under nodes unless lifted.
 *
 * Frames must be click-through, and React Flow's own .react-flow__node wrapper
 * keeps pointer events regardless of the component's style; the !important is
 * load-bearing. The title strip / chip re-enables them so a frame stays
 * selectable.
 */
const LABEL_LAYER_CSS = [
  ".react-flow__edgelabel-renderer { z-index: 6; }",
  ".react-flow__node-zone, .react-flow__node-serviceGroup { pointer-events: none !important; }",
  ".react-flow__node-zone > div > span, .react-flow__node-serviceGroup > div > div { pointer-events: all !important; }",
].join("\n");

/**
 * Which edge did that click mean? Sample every rendered path and take the
 * closest within HIT_RADIUS_PX. Fat invisible hit paths resolve by paint
 * order, not proximity, which left edges under a neighbour unselectable.
 */
const HIT_RADIUS_PX = 16;

function nearestEdgeId(root: HTMLElement, cx: number, cy: number): string | null {
  let best: string | null = null;
  let bestD2 = HIT_RADIUS_PX * HIT_RADIUS_PX;
  for (const el of Array.from(root.querySelectorAll<SVGPathElement>(".react-flow__edge-path"))) {
    const id = el.closest(".react-flow__edge")?.getAttribute("data-id");
    if (!id) continue;
    const ctm = el.getScreenCTM();
    const svg = el.ownerSVGElement;
    if (!ctm || !svg) continue;
    const len = el.getTotalLength();
    if (!len) continue;
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

export default function ArchDiagram({
  diagram: authored,
  palette,
}: {
  diagram: Diagram;
  palette: Palette;
}) {
  const layout: Layout = useMemo(() => layoutDiagram(authored), [authored]);
  const diagram = layout.diagram;
  const [sel, setSel] = useState<Selection | null>(null);
  const [hover, setHover] = useState<string | null>(null);

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
      diagram.nodes
        .filter((n) => layout.rects[n.id])
        .map((n) => {
          const collapsed = layout.collapsed.has(n.id);
          const frame = isFrame(n.kind) && !collapsed;
          return {
            id: n.id,
            type: frame ? (n.kind === "zone" ? "zone" : "serviceGroup") : "box",
            position: { x: layout.rects[n.id].x, y: layout.rects[n.id].y },
            draggable: false,
            selectable: true,
            zIndex: frame ? 0 : 1,
            data: {
              node: n,
              rect: layout.rects[n.id],
              palette,
              selected: sel?.kind === "node" && sel.id === n.id,
              dimmed: !!lit && !lit.has(n.id),
              stages: collapsed ? layout.pipelines[n.id]?.length : undefined,
            } satisfies NodeData,
          };
        }),
    [diagram, layout, palette, sel, lit],
  );

  const selectEdge = useCallback((id: string) => {
    setSel((cur) => (cur?.kind === "edge" && cur.id === id ? null : { kind: "edge", id }));
  }, []);

  const edges: Edge[] = useMemo(
    () =>
      diagram.edges
        .filter((e) => layout.routes[e.id])
        .map((e) => {
          const route = layout.routes[e.id];
          const tier = tierOf(e);
          const isSel = sel?.kind === "edge" && sel.id === e.id;
          const isHover = hover === e.id;
          const touchesSel = sel?.kind === "node" && (e.from === sel.id || e.to === sel.id);
          const dim = !!lit && !isSel && !(lit.has(e.from) && lit.has(e.to));
          const hot = tier === "hot";
          const stroke = isSel
            ? palette.accent
            : dim
              ? palette.border
              : hot
                ? palette.accent
                : tier === "control"
                  ? palette.textMuted
                  : palette.text;
          const width = isSel ? (hot ? 3.2 : 2.2) : isHover ? (hot ? 3 : 2) : hot ? 2.4 : 1.2;
          const label = layout.labels[e.id];
          return {
            id: e.id,
            type: "routed",
            source: e.from,
            target: e.to,
            sourceHandle: route.fromSide,
            targetHandle: route.toSide,
            data: {
              points: route.points,
              label: e.label,
              showLabel: hot || isSel || isHover || !!touchesSel,
              lx: label?.[0],
              ly: label?.[1],
              fg: isSel || hot ? palette.accent : palette.textMuted,
              bg: palette.bg,
              border: isSel || hot ? `${palette.accent}88` : palette.border,
              bold: hot,
            } satisfies EdgeData,
            animated: hot && !!e.animated && !dim,
            style: {
              stroke,
              strokeWidth: width,
              strokeDasharray: tier === "control" ? "5 4" : undefined,
              opacity: dim ? 0.3 : hot ? 1 : 0.8,
              cursor: "pointer",
              transition: "opacity 140ms ease, stroke-width 140ms ease",
            },
            // Sized in flow units; at the 0.8+ zoom the gate guarantees this is ~11-14px.
            markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: hot ? 16 : 14, height: hot ? 16 : 14 },
          };
        }),
    [diagram, layout, palette, sel, lit, hover],
  );

  const onNodeClick = useCallback((_e: unknown, n: Node) => {
    setSel((cur) => (cur?.kind === "node" && cur.id === n.id ? null : { kind: "node", id: n.id }));
  }, []);
  const onEdgeClick = useCallback((_e: unknown, ed: Edge) => selectEdge(ed.id), [selectEdge]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const width = useWidth(wrapRef);
  const narrow = width > 0 && width < 720;

  const anchorX = selNode ? layout.rects[selNode.id].x + layout.rects[selNode.id].w / 2 : 0;
  const side: "left" | "right" =
    selNode && anchorX > layout.bounds.x + layout.bounds.w / 2 ? "left" : "right";

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
        onEdgeMouseEnter={(_e, ed) => setHover(ed.id)}
        onEdgeMouseLeave={() => setHover(null)}
        onPaneClick={(ev) => {
          const root = wrapRef.current;
          const id = root ? nearestEdgeId(root, ev.clientX, ev.clientY) : null;
          if (id) selectEdge(id);
          else setSel(null);
        }}
        fitView
        fitViewOptions={{ padding: 0.06, maxZoom: 1.15 }}
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
          pipeline={layout.pipelines[selNode.id]}
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
      Tap any box or arrow. Bold arrows are the hot path; hover a thin one for its label.
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

function PanelHeader({ p, title, sub, onClose }: { p: Palette; title: string; sub?: string; onClose: () => void }) {
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

/** The stages hidden inside a collapsed service, in order. */
function Pipeline({ p, stages }: { p: Palette; stages: PipelineStage[] }) {
  return (
    <>
      <Label p={p}>Pipeline</Label>
      {stages.map((s, i) => (
        <div key={s.id} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 8, marginTop: 7 }}>
          <div
            style={{
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
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <span style={{ color: p.textStrong, fontWeight: 600 }}>{s.label}</span>
            {s.sub ? <span style={{ color: p.textMuted }}> — {s.sub}</span> : null}
            {s.talksTo.length ? (
              <div style={{ color: p.textMuted, fontSize: 12 }}>{s.talksTo.join(" · ")}</div>
            ) : null}
          </div>
        </div>
      ))}
    </>
  );
}

function DetailPanel({
  title,
  sub,
  detail,
  pipeline,
  palette: p,
  narrow,
  side,
  onClose,
}: {
  title: string;
  sub?: string;
  detail: DiagramNodeDetail;
  pipeline?: PipelineStage[];
  palette: Palette;
  narrow: boolean;
  side: "left" | "right";
  onClose: () => void;
}) {
  return (
    <div style={{ ...panelChrome(p), ...panelPlacement(narrow, side) }}>
      <PanelHeader p={p} title={title} sub={sub} onClose={onClose} />
      {pipeline?.length ? <Pipeline p={p} stages={pipeline} /> : null}
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
          : { top: 62, left: 12, width: "min(440px, calc(100% - 24px))", maxHeight: "calc(100% - 76px)" }),
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

function ChoiceBlock({ p, c }: { p: Palette; c: TechChoice }) {
  const Row = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
    <div style={{ marginTop: 8 }}>
      <span style={{ color: p.textMuted, fontSize: 11.5, fontWeight: 700 }}>{k} </span>
      <span style={{ color: tone ?? p.text, fontSize: 13, lineHeight: 1.5 }}>{v}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 16, padding: "12px 13px", borderRadius: 10, border: `1px solid ${p.border}`, background: p.codeBg }}>
      <div style={{ color: p.accent, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
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
    <div style={{ color: p.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 14, fontWeight: 700 }}>
      {children}
    </div>
  );
}

function Section({ p, title, body, accent }: { p: Palette; title: string; body: string; accent?: boolean }) {
  return (
    <>
      <Label p={p}>{title}</Label>
      <div style={{ color: accent ? p.errorFg : p.text, fontSize: 13.5, lineHeight: 1.55, marginTop: 5 }}>{body}</div>
    </>
  );
}
