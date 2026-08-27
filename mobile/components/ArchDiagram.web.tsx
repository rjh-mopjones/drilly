import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Diagram, DiagramNode, NodeKind } from "../lib/diagrams";
import type { Palette } from "../lib/theme";

/**
 * Interactive architecture diagram (web). The native app is a WebView shell
 * over the web build, so this renders on every surface; ArchDiagram.tsx is a
 * compile-time stub for the native bundle.
 *
 * Diagrams are data (lib/diagrams.ts). Selecting a node opens its explanation,
 * which is the point of the screen: the picture is the index, the panel is the
 * content.
 */

const SIDE: Record<string, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** Per-kind accent, derived from the palette so themes stay in charge. */
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

function ZoneNode({ data }: NodeProps) {
  const { node, palette: p } = data as unknown as NodeData;
  return (
    <div
      style={{
        width: node.w ?? 300,
        height: node.h ?? 300,
        boxSizing: "border-box",
        border: `1.2px dashed ${p.border}`,
        borderRadius: 12,
        background: `${p.text}06`,
        pointerEvents: "none",
      }}
    >
      <div style={{ color: p.textMuted, fontSize: 12, padding: "8px 12px", fontWeight: 600 }}>
        {node.label}
      </div>
    </div>
  );
}

const NODE_TYPES = { box: BoxNode, zone: ZoneNode };

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
  diagram,
  palette,
}: {
  diagram: Diagram;
  palette: Palette;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => diagram.nodes.find((n) => n.id === selectedId) ?? null,
    [diagram, selectedId],
  );

  /** Neighbours of the selection stay lit; everything else dims. */
  const lit = useMemo(() => {
    if (!selectedId) return null;
    const s = new Set<string>([selectedId]);
    for (const e of diagram.edges) {
      if (e.from === selectedId) s.add(e.to);
      if (e.to === selectedId) s.add(e.from);
    }
    return s;
  }, [diagram, selectedId]);

  const nodes: Node[] = useMemo(
    () =>
      diagram.nodes.map((n) => ({
        id: n.id,
        type: n.kind === "group" ? "zone" : "box",
        position: { x: n.x, y: n.y },
        draggable: false,
        selectable: n.kind !== "group",
        zIndex: n.kind === "group" ? 0 : 1,
        data: {
          node: n,
          palette,
          selected: n.id === selectedId,
          dimmed: !!lit && !lit.has(n.id) && n.kind !== "group",
        },
      })),
    [diagram, palette, selectedId, lit],
  );

  const edges: Edge[] = useMemo(
    () =>
      diagram.edges.map((e) => {
        const dim = !!lit && !(lit.has(e.from) && lit.has(e.to));
        const stroke = dim
          ? palette.border
          : e.animated
            ? palette.accent
            : e.dashed
              ? palette.textMuted
              : palette.text;
        return {
          id: e.id,
          type: "smoothstep",
          pathOptions: { borderRadius: 10, offset: e.offset ?? 20 },
          source: e.from,
          target: e.to,
          sourceHandle: e.fromSide ?? "bottom",
          targetHandle: e.toSide ?? "top",
          label: e.label,
          animated: !!e.animated && !dim,
          style: {
            stroke,
            strokeWidth: 1.6,
            strokeDasharray: e.dashed ? "5 4" : undefined,
            opacity: dim ? 0.35 : 1,
            transition: "opacity 140ms ease",
          },
          labelStyle: { fill: palette.textMuted, fontSize: 11.5 },
          labelBgStyle: { fill: palette.bg },
          labelBgPadding: [5, 3] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
        };
      }),
    [diagram, palette, lit],
  );

  const onNodeClick = useCallback((_e: unknown, n: Node) => {
    setSelectedId((cur) => (cur === n.id ? null : n.id));
  }, []);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const width = useWidth(wrapRef);
  const narrow = width > 0 && width < 720;
  /** Keep the panel off the node it describes. */
  const maxX = useMemo(
    () => Math.max(...diagram.nodes.map((n) => n.x + (n.w ?? 240))),
    [diagram],
  );
  const side: "left" | "right" =
    selected && selected.x + (selected.w ?? 240) / 2 > maxX / 2 ? "left" : "right";

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedId(null)}
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

      {selected?.detail ? (
        <DetailPanel
          node={selected}
          palette={palette}
          narrow={narrow}
          side={side}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <Hint palette={palette} />
      )}
    </div>
  );
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
        fontSize: 12.5,
        pointerEvents: "none",
      }}
    >
      Tap a component for what it does, why it exists, and what breaks.
    </div>
  );
}

function DetailPanel({
  node,
  palette: p,
  narrow,
  side,
  onClose,
}: {
  node: DiagramNode;
  palette: Palette;
  narrow: boolean;
  side: "left" | "right";
  onClose: () => void;
}) {
  const d = node.detail;
  if (!d) return null;
  // Narrow viewports get a bottom sheet so the diagram stays visible above it;
  // wide ones get a side panel, flipped away from the node it describes.
  const place: React.CSSProperties = narrow
    ? { left: 10, right: 10, bottom: 10, maxHeight: "52%" }
    : {
        top: 12,
        [side]: 12,
        width: "min(370px, calc(100% - 24px))",
        maxHeight: "calc(100% - 24px)",
      };
  return (
    <div
      style={{
        position: "absolute",
        ...place,
        overflowY: "auto",
        padding: 16,
        borderRadius: 12,
        background: p.surface,
        border: `1px solid ${p.border}`,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ color: p.textStrong, fontSize: 16, fontWeight: 700 }}>{node.label}</div>
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
          }}
        >
          ✕
        </button>
      </div>
      {node.sub ? (
        <div style={{ color: p.accent, fontSize: 12.5, marginTop: 2 }}>{node.sub}</div>
      ) : null}

      <Section p={p} title="What it is" body={d.what} />
      <Section p={p} title="Why it exists" body={d.why} />
      {d.numbers?.length ? (
        <>
          <Label p={p}>Numbers</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {d.numbers.map((n) => (
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
      ) : null}
      {d.breaks ? <Section p={p} title="What breaks" body={d.breaks} accent /> : null}
    </div>
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
