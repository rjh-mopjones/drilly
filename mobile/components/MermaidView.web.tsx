import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import type { Palette } from "../lib/theme";

interface Props {
  /** Raw mermaid diagram source (no surrounding ```mermaid fences). */
  source: string;
  /** App theme — drives mermaid's colour palette. */
  scheme: "dark" | "light";
  /** Surface colour from the app palette so the SVG blends in. */
  palette: Palette;
}

/**
 * Web mermaid renderer.
 *
 * On web, `react-native-webview` has no implementation ("does not support
 * this platform"), so the native WebView path in `MermaidView.tsx` can never
 * work in the browser. Metro resolves this `.web.tsx` for the web bundle and
 * leaves the native file for iOS/Android. Here we render mermaid straight
 * into the DOM: fit-to-width inline, tap for a fullscreen modal with zoom +
 * pan. No WebView, no postMessage height dance.
 *
 * Mermaid is loaded once from the CDN (same source the native path used) and
 * memoised across every diagram on the page. If the CDN is blocked we fall
 * back to showing the diagram source as text rather than an error.
 */

declare global {
  interface Window {
    mermaid?: MermaidApi;
  }
}

interface MermaidApi {
  initialize: (cfg: Record<string, unknown>) => void;
  render: (id: string, src: string) => Promise<{ svg: string }>;
}

const MERMAID_CDN =
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

let mermaidPromise: Promise<MermaidApi> | null = null;
let renderCounter = 0;

function loadMermaid(): Promise<MermaidApi> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("no DOM"));
  }
  if (window.mermaid) return Promise.resolve(window.mermaid);
  if (mermaidPromise) return mermaidPromise;

  mermaidPromise = new Promise<MermaidApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MERMAID_CDN;
    script.async = true;
    script.onload = () =>
      window.mermaid
        ? resolve(window.mermaid)
        : reject(new Error("mermaid loaded but global missing"));
    script.onerror = () => {
      mermaidPromise = null; // allow a later retry
      reject(new Error("failed to load mermaid from CDN"));
    };
    document.head.appendChild(script);
  });
  return mermaidPromise;
}

async function renderToSvg(
  source: string,
  scheme: "dark" | "light",
): Promise<string> {
  const mermaid = await loadMermaid();
  // initialize is cheap and global; call before each render so the diagram
  // follows the current app theme (dark mode -> dark mermaid theme).
  mermaid.initialize({
    startOnLoad: false,
    theme: scheme === "dark" ? "dark" : "default",
    securityLevel: "loose",
    flowchart: { htmlLabels: true, useMaxWidth: true },
    sequence: { useMaxWidth: true },
  });
  renderCounter += 1;
  const id = `mmd-${renderCounter}-${Date.now().toString(36)}`;
  const { svg } = await mermaid.render(id, source);
  return svg;
}

/**
 * Injects an SVG string into a real DOM node (the web View's host element)
 * and applies fit/scale styling imperatively. React never manages the SVG's
 * children, so innerHTML is safe here.
 */
function SvgHost({
  svg,
  fit,
  scale,
}: {
  svg: string;
  fit: boolean;
  scale: number;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = svg;
    const el = host.querySelector("svg") as SVGSVGElement | null;
    if (!el) return;
    el.style.height = "auto";
    el.style.transformOrigin = "top left";
    el.style.display = "block";
    if (fit) {
      el.style.width = "100%";
      el.style.maxWidth = "100%";
      el.style.transform = "";
    } else {
      el.style.width = "";
      el.style.maxWidth = "none";
      el.style.transform = `scale(${scale})`;
    }
  }, [svg, fit, scale]);

  // RNW forwards a callback ref the underlying DOM element on web.
  return (
    <View
      ref={(node) => {
        ref.current = (node as unknown as HTMLElement) ?? null;
      }}
    />
  );
}

export default function MermaidView({ source, scheme, palette }: Props) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSvg("");
    renderToSvg(source, scheme)
      .then((out) => {
        if (!cancelled) setSvg(out);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [source, scheme]);

  if (failed) {
    // Graceful fallback: show the diagram source rather than a scary error.
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackLabel}>Diagram (source)</Text>
        <Text style={styles.fallbackSource}>{source.trim()}</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.inline}
        accessibilityLabel="Open diagram fullscreen"
      >
        {svg ? (
          <SvgHost svg={svg} fit scale={1} />
        ) : (
          <Text style={styles.loading}>Rendering diagram…</Text>
        )}
        <View style={styles.zoomBadge} pointerEvents="none">
          <Text style={styles.zoomGlyph}>⤢</Text>
        </View>
      </Pressable>

      {open ? (
        <FullscreenDiagram
          svg={svg}
          palette={palette}
          styles={styles}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function FullscreenDiagram({
  svg,
  palette,
  styles,
  onClose,
}: {
  svg: string;
  palette: Palette;
  styles: ReturnType<typeof makeStyles>;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const clamp = (v: number) => Math.min(6, Math.max(0.4, v));

  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalRoot, { backgroundColor: palette.codeBg }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Diagram</Text>
          <View style={styles.zoomControls}>
            <Pressable
              onPress={() => setScale((s) => clamp(s / 1.25))}
              style={styles.zoomBtn}
              accessibilityLabel="Zoom out"
            >
              <Text style={styles.zoomBtnText}>−</Text>
            </Pressable>
            <Pressable
              onPress={() => setScale(1)}
              style={styles.zoomBtn}
              accessibilityLabel="Reset zoom"
            >
              <Text style={styles.zoomBtnText}>⟲</Text>
            </Pressable>
            <Pressable
              onPress={() => setScale((s) => clamp(s * 1.25))}
              style={styles.zoomBtn}
              accessibilityLabel="Zoom in"
            >
              <Text style={styles.zoomBtnText}>+</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={styles.zoomBtn}
              accessibilityLabel="Close diagram view"
            >
              <Text style={[styles.zoomBtnText, { color: palette.accent }]}>
                ✕
              </Text>
            </Pressable>
          </View>
        </View>
        {/* overflow:scroll gives pan (drag on touch, scrollbars on desktop) */}
        <View style={styles.modalScroll}>
          <View style={styles.modalInner}>
            <SvgHost svg={svg} fit={false} scale={scale} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    inline: {
      position: "relative",
      backgroundColor: p.codeBg,
      width: "100%",
      padding: 12,
      borderRadius: 8,
    },
    loading: {
      color: p.textMuted,
      fontSize: 13,
      paddingVertical: 24,
      textAlign: "center",
    },
    zoomBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 26,
      height: 26,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 13,
      backgroundColor: p.surfacePressed,
      opacity: 0.9,
    },
    zoomGlyph: { color: p.textMuted, fontSize: 15, lineHeight: 15 },
    fallback: {
      backgroundColor: p.codeBg,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: p.border,
    },
    fallbackLabel: {
      color: p.textMuted,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    fallbackSource: {
      color: p.text,
      fontFamily: "JetBrains Mono, ui-monospace, Menlo, Consolas, monospace",
      fontSize: 12,
      lineHeight: 18,
    },
    modalRoot: { flex: 1 },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      backgroundColor: p.surface,
    },
    modalTitle: { color: p.textStrong, fontSize: 15, fontWeight: "600" },
    zoomControls: { flexDirection: "row", alignItems: "center", gap: 6 },
    zoomBtn: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      backgroundColor: p.surfacePressed,
    },
    zoomBtnText: { color: p.textStrong, fontSize: 18, lineHeight: 20 },
    modalScroll: {
      flex: 1,
      // overflow:scroll drives DOM scrolling/pan on web (drag on touch)
      overflow: "scroll",
    },
    modalInner: { padding: 16, alignItems: "flex-start" },
  });
}
