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
import { UI_FONT, type Palette } from "../lib/theme";

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

function kindColor(kind: NodeKind, p: Palette): string {
  switch (kind) {
    case "bus":
      return p.accent;
    case "store":
      return p.textMuted;
    case "external":
      return p.errorFg;
    default:
      return p.text;
  }
}

type NodeData = {
  node: DiagramNode;
  palette: Palette;
  selected: boolean;
  dimmed: boolean;
};

function BoxNode({ data }: NodeProps) {
  const { node, palette: p, selected, dimmed } = data as unknown as NodeData;
  const color = kindColor(node.kind, p);
  const handles = ["top", "right", "bottom", "left"] as const;
  return (
    <div
      style={{
        width: node.w ?? 240,
        boxSizing: "border-box",
        padding: "12px 14px",
        borderRadius: 10,
        border: `1.5px solid ${selected ? p.accent : color}`,
        background: selected ? p.surfacePressed : p.surface,
        opacity: dimmed ? 0.32 : 1,
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
      <div style={{ color: p.textStrong, fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>
        {node.label}
      </div>
      {node.sub ? (
        <div style={{ color: p.textMuted, fontSize: 12.5, marginTop: 4, lineHeight: 1.3 }}>
          {node.sub}
        </div>
      ) : null}
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
    boxes?: { x: number; y: number; w: number; h: number }[];
  };
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
    offset: d.offset ?? 20,
  });
  // The midpoint of an edge that routes across a box lands on that box. The
  // label is drawn above the node layer so it stays readable, but it would sit
  // on top of the node's own title, so slide it clear of whichever box it hit.
  let ly = labelY;
  for (const b of d.boxes ?? []) {
    if (labelX < b.x || labelX > b.x + b.w || ly < b.y || ly > b.y + b.h) continue;
    const above = b.y - 12;
    const below = b.y + b.h + 12;
    ly = ly - b.y < b.y + b.h - ly ? above : below;
    break;
  }

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={26} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${ly}px)`,
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

const NODE_TYPES = { box: BoxNode, zone: ZoneNode };
const EDGE_TYPES = { labelled: LabelledEdge };

/**
 * React Flow emits .react-flow__edgelabel-renderer BEFORE .react-flow__nodes in
 * the DOM and leaves both at `z-index: auto`, so paint order alone puts edge
 * labels underneath every node. Lift the label layer so a label on an edge that
 * routes across a box stays readable.
 */
const LABEL_LAYER_CSS = ".react-flow__edgelabel-renderer { z-index: 6; }";

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
const MIN_GUTTER = 190; // ~28 chars at 11.5px, the label cap the checker enforces
const MIN_ROW_GAP = 46; // label height plus its background padding
const COL_TOLERANCE = 60;
const ROW_TOLERANCE = 40;
const DEFAULT_H = 76;

function spaceColumns(d: Diagram): Diagram {
  const boxes = d.nodes.filter((n) => n.kind !== "group");
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
    if (n.kind !== "group") {
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
        type: n.kind === "group" ? "zone" : "box",
        position: { x: n.x, y: n.y },
        draggable: false,
        selectable: true,
        zIndex: n.kind === "group" ? 0 : 1,
        data: {
          node: n,
          palette,
          selected: sel?.kind === "node" && sel.id === n.id,
          dimmed: !!lit && !lit.has(n.id),
        },
      })),
    [diagram, palette, sel, lit],
  );

  const boxRects = useMemo(
    () =>
      diagram.nodes
        .filter((n) => n.kind !== "group")
        .map((n) => ({ x: n.x, y: n.y, w: n.w ?? 240, h: n.h ?? 76 })),
    [diagram],
  );

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
            boxes: boxRects,
            offset: e.offset ?? 20,
            fg: isSel ? palette.accent : palette.textMuted,
            bg: palette.bg,
            border: palette.border,
          },
          source: e.from,
          target: e.to,
          sourceHandle: e.fromSide ?? "bottom",
          targetHandle: e.toSide ?? "top",
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
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
        };
      }),
    [diagram, palette, sel, lit, boxRects],
  );

  const onNodeClick = useCallback((_e: unknown, n: Node) => {
    setSel((cur) => (cur?.kind === "node" && cur.id === n.id ? null : { kind: "node", id: n.id }));
  }, []);
  const onEdgeClick = useCallback((_e: unknown, ed: Edge) => {
    setSel((cur) => (cur?.kind === "edge" && cur.id === ed.id ? null : { kind: "edge", id: ed.id }));
  }, []);

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
        onPaneClick={() => setSel(null)}
        fitView
        fitViewOptions={{ padding: 0.22 }}
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
