import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import type { Palette } from "../lib/theme";

interface Props {
  /** Raw inline-SVG source (a `<svg ...>...</svg>` string). */
  source: string;
  scheme: "dark" | "light";
  palette: Palette;
}

/**
 * Renderer for hand-authored inline-SVG architecture diagrams (the ```svg
 * fence). Unlike mermaid these are drawn by hand — intentional box/arrow
 * placement, the "service diagram you'd sketch in an interview". The SVG is
 * authored with `currentColor` (and `var(--accent)`) so it inherits the app
 * theme; here we just inject it, scale it to fit the column, and offer a
 * tap-to-fullscreen view with zoom + pan.
 *
 * Web-only (`.web.tsx`); the native app is a WebView shell over the web
 * build, so this is what actually renders on every surface.
 */

/** Inject an SVG string into a DOM host and scale to fit (or user zoom). */
function SvgHost({
  source,
  palette,
  fit,
  scale,
}: {
  source: string;
  palette: Palette;
  fit: boolean;
  scale: number;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // currentColor -> theme text; --accent -> theme accent.
    host.style.color = palette.text;
    host.style.setProperty("--accent", palette.accent);
    host.innerHTML = source;
    const el = host.querySelector("svg") as SVGSVGElement | null;
    if (!el) return;
    el.style.transformOrigin = "top left";
    el.style.display = "block";
    el.style.maxWidth = "none";

    let vbW = 0;
    let vbH = 0;
    const vb = el.getAttribute("viewBox");
    if (vb) {
      const p = vb.split(/[ ,]+/).map(Number);
      vbW = p[2] || 0;
      vbH = p[3] || 0;
    }
    // Size from what is drawn, measured in this page with its real fonts, not
    // from the declared box: a hand-set viewBox clips centred text near an
    // edge or leaves a void under a short drawing.
    const fitToContent = () => {
      try {
        const bb = el.getBBox();
        if (bb.width > 0 && bb.height > 0) {
          const pad = 8;
          vbW = bb.width + pad * 2;
          vbH = bb.height + pad * 2;
          el.setAttribute("viewBox", `${bb.x - pad} ${bb.y - pad} ${vbW} ${vbH}`);
          el.style.width = `${vbW}px`;
          el.style.height = `${vbH}px`;
        }
      } catch {
        /* not laid out yet */
      }
    };
    fitToContent();
    el.style.width = vbW ? `${vbW}px` : "";
    el.style.height = vbH ? `${vbH}px` : "auto";

    if (!fit) {
      el.style.transform = `scale(${scale})`;
      host.style.height = "";
      host.style.overflow = "";
      return;
    }

    // Inline: no transform. An svg with a viewBox and width: 100% takes its
    // height from its own aspect ratio, so nothing letterboxes it inside a
    // host box of the wrong height. Cap the growth on wide columns so a
    // phone-sized figure does not balloon on a desktop.
    const applyFit = () => {
      el.removeAttribute("width");
      el.removeAttribute("height");
      el.style.transform = "";
      el.style.width = "100%";
      el.style.height = "auto";
      el.style.maxWidth = vbW ? `${Math.round(vbW * 1.4)}px` : "";
      host.style.height = "";
      host.style.width = "100%";
      host.style.overflow = "hidden";
    };
    applyFit();
    // Fonts can land after first paint; re-measure once they are ready.
    const fontsReady: Promise<unknown> | undefined = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
    if (fontsReady) fontsReady.then(() => { fitToContent(); applyFit(); }).catch(() => {});
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && host.parentElement) {
      ro = new ResizeObserver(applyFit);
      ro.observe(host.parentElement);
    }
    return () => {
      if (ro) ro.disconnect();
    };
  }, [source, palette, fit, scale]);

  return (
    <View
      ref={(node) => {
        ref.current = (node as unknown as HTMLElement) ?? null;
      }}
    />
  );
}

export default function SvgDiagram({ source, palette }: Props) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.inline}
        accessibilityLabel="Open diagram fullscreen"
      >
        <SvgHost source={source} palette={palette} fit scale={1} />
        <View style={styles.zoomBadge} pointerEvents="none">
          <Text style={styles.zoomGlyph}>⤢</Text>
        </View>
      </Pressable>
      {open ? (
        <Fullscreen
          source={source}
          palette={palette}
          styles={styles}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function Fullscreen({
  source,
  palette,
  styles,
  onClose,
}: {
  source: string;
  palette: Palette;
  styles: ReturnType<typeof makeStyles>;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const clamp = (v: number) => Math.min(6, Math.max(0.4, v));
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: palette.codeBg }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Diagram</Text>
          <View style={styles.zoomControls}>
            <Pressable onPress={() => setScale((s) => clamp(s / 1.25))} style={styles.zoomBtn}>
              <Text style={styles.zoomBtnText}>−</Text>
            </Pressable>
            <Pressable onPress={() => setScale(1)} style={styles.zoomBtn}>
              <Text style={styles.zoomBtnText}>⟲</Text>
            </Pressable>
            <Pressable onPress={() => setScale((s) => clamp(s * 1.25))} style={styles.zoomBtn}>
              <Text style={styles.zoomBtnText}>+</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.zoomBtn}>
              <Text style={[styles.zoomBtnText, { color: palette.accent }]}>✕</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.modalScroll}>
          <View style={styles.modalInner}>
            <SvgHost source={source} palette={palette} fit={false} scale={scale} />
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
      padding: 14,
      borderRadius: 8,
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
