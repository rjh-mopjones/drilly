import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Platform,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import Markdown from "react-native-markdown-display";
import { sortSections, type Pattern, type SourceConfig } from "../lib/parser";
import {
  getRevealedSections,
  setRevealedSections,
} from "../lib/storage";
import { useSettings } from "../lib/settings";
import { useTheme, MONO_FONT, type Palette } from "../lib/theme";
import { markdownRules } from "./CodeBlock";
import { getDiagram, getDiagramForItem, itemRoute } from "../lib/diagrams";
import { GlossedText, type Terms } from "./GlossedText";
import ArchDiagram from "./ArchDiagram";
import { CopyButton } from "./CopyButton";

interface Props {
  source: SourceConfig;
  item: Pattern;
  /** Adjacent-item navigation (per-source "prev / next problem"). */
  onNeighbourItem: (delta: 1 | -1) => void;
}

/**
 * Reveal-on-tap reader. Replaces the previous paginated PagerView with
 * the simpler "section cards" UX from the old web app: each section is a
 * collapsible card with a tap-to-toggle header. Default-revealed sections
 * (see `SourceConfig.defaultRevealedSections`) expand on first open;
 * everything else stays hidden until the user taps to reveal — useful for
 * studying problems where you want to read the prompt first and force
 * yourself to think before peeking at the answer.
 */
export function ItemView({ source, item, onNeighbourItem }: Props) {
  const palette = useTheme();
  const router = useRouter();

  /**
   * Keep in-app links (e.g. the "Interactive diagram" section's
   * /diagram/<id>) inside the router. Returning false tells
   * react-native-markdown-display not to hand the URL to Linking.openURL,
   * which on web would be a full page load. External URLs fall through.
   */
  const handleLinkPress = useCallback(
    (url: string) => {
      if (url.startsWith("/")) {
        router.push(url as never);
        return false;
      }
      return true;
    },
    [router],
  );
  const settings = useSettings();
  const styles = useMemo(
    () => makeStyles(palette, settings.eReaderMode),
    [palette, settings.eReaderMode],
  );
  const markdownStyles = useMemo(
    () => makeMarkdownStyles(palette, settings.fontScale),
    [palette, settings.fontScale],
  );

  const sortedSections = useMemo(
    () => sortSections(item.sections, source.sectionOrder),
    [item, source],
  );

  // The item's diagram lends its box labels to the glossary ("Sketch workers"
  // is defined by its own "what it is") and its picture to focus embeds.
  const diagram = useMemo(() => getDiagramForItem(source.id, item.id), [source.id, item.id]);
  const terms = useMemo<Terms | undefined>(() => {
    if (!diagram) return undefined;
    const out: Terms = {};
    for (const n of diagram.nodes) {
      if (!n.detail) continue;
      out[n.label] = n.detail.what;
      const short = n.label.replace(/\s*\(.*\)$/, "");
      if (short !== n.label) out[short] = n.detail.what;
    }
    return out;
  }, [diagram]);
  const rules = useMemo(
    () => makeRules(palette, terms, (url) => router.push(url as never)),
    [palette, terms, router],
  );

  // revealed = set of section names currently expanded. Hydrated from
  // AsyncStorage on mount; falls back to source.defaultRevealedSections.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getRevealedSections(source.id, item.id);
      if (cancelled) return;
      if (saved.length > 0) {
        setRevealed(new Set(saved));
      } else if (source.defaultRevealedSections.includes("*")) {
        // A write-up, not a quiz: everything open from the start.
        setRevealed(new Set(sortedSections.map((s) => s.name)));
      } else {
        // No saved state — seed from manifest defaults, plus the Summary
        // card if the user has the auto-reveal setting on AND this item
        // actually has a section named "Summary". Per-item toggles always
        // win after first visit (they take the `saved.length > 0` branch).
        const initial = new Set(source.defaultRevealedSections);
        if (
          settings.autoRevealSummary &&
          sortedSections.some((s) => s.name === "Summary")
        ) {
          initial.add("Summary");
        }
        setRevealed(initial);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    source.id,
    source.defaultRevealedSections,
    item.id,
    settings.autoRevealSummary,
    sortedSections,
  ]);

  // Persist on every change (after hydration so we don't overwrite saved
  // state with the initial empty set on mount).
  useEffect(() => {
    if (!hydrated) return;
    setRevealedSections(source.id, item.id, Array.from(revealed));
  }, [hydrated, source.id, item.id, revealed]);

  const toggle = useCallback(
    (name: string) => {
      setRevealed((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      });
    },
    [],
  );

  const showAll = useCallback(() => {
    setRevealed(new Set(sortedSections.map((s) => s.name)));
  }, [sortedSections]);

  const hideAll = useCallback(() => {
    setRevealed(new Set());
  }, []);

  const revealNext = useCallback(() => {
    const next = sortedSections.find((s) => !revealed.has(s.name));
    if (!next) return;
    setRevealed((prev) => {
      const n = new Set(prev);
      n.add(next.name);
      return n;
    });
  }, [sortedSections, revealed]);

  // Web-only keyboard shortcuts. Space reveals the next hidden section in
  // order — mirrors the old web's study-mode flow. Esc collapses everything.
  // Disabled inside text inputs so a user typing somewhere isn't hijacked.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof document === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.matches?.("input, textarea, [contenteditable='true']")) return;
      if (e.code === "Space") {
        e.preventDefault();
        revealNext();
      } else if (e.code === "Escape") {
        e.preventDefault();
        hideAll();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [revealNext, hideAll]);

  // Count only sections that actually exist in this item. Saved reveal state
  // stores section *names*, so a name that has since been renamed or removed
  // lingers in the set: counting `revealed.size` directly would over-report
  // progress and leave allRevealed permanently false, sticking the toggle on
  // "Show all". Filtering against sortedSections makes stale names inert.
  const revealedCount = sortedSections.filter((s) =>
    revealed.has(s.name),
  ).length;

  const allRevealed =
    revealedCount > 0 && revealedCount === sortedSections.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push((getDiagramForItem(source.id, item.id) ? itemRoute(source.id, item.id) : `/source/${source.id}`) as never)}
          style={styles.backButton}
          accessibilityLabel={`Back to ${source.title}`}
        >
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <View style={styles.headerTitle}>
          {/* Crumb shows the parent source so the user always knows where
              up goes — tap it to jump to the source's item list. */}
          <Pressable
            onPress={() => router.push(`/source/${source.id}`)}
            accessibilityLabel={`Open ${source.title} list`}
          >
            <Text style={styles.headerCrumb} numberOfLines={1}>
              {source.title.toUpperCase()} · {source.itemLabel} {item.id}
            </Text>
          </Pressable>
          <Text style={styles.headerName} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <CopyButton item={item} source={source} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyInner}
      >
        <View style={styles.controlsRow}>
          <Pressable
            onPress={allRevealed ? hideAll : showAll}
            style={({ pressed }) => [
              styles.controlButton,
              pressed && styles.controlButtonPressed,
            ]}
          >
            <Text style={styles.controlText}>
              {allRevealed ? "Hide all" : "Show all"}
            </Text>
          </Pressable>
          <Text style={styles.progressText}>
            {revealedCount} / {sortedSections.length}
          </Text>
        </View>

        {sortedSections.map((section) => {
          const open = revealed.has(section.name);
          return (
            <View key={section.name} style={styles.sectionCard}>
              <Pressable
                onPress={() => toggle(section.name)}
                style={({ pressed }) => [
                  styles.sectionHeader,
                  pressed && styles.sectionHeaderPressed,
                ]}
              >
                <Text style={styles.sectionToggle}>{open ? "▾" : "▸"}</Text>
                <Text style={styles.sectionName}>{section.name}</Text>
              </Pressable>
              {open && (
                <View style={styles.sectionBody}>
                  <Markdown
                    style={markdownStyles}
                    rules={rules}
                    onLinkPress={handleLinkPress}
                  >
                    {section.content}
                  </Markdown>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.footerNav}>
          <Pressable
            onPress={() => onNeighbourItem(-1)}
            style={styles.footerButton}
          >
            <Text style={styles.footerButtonText}>‹ Previous</Text>
          </Pressable>
          <Pressable
            onPress={() => onNeighbourItem(1)}
            style={styles.footerButton}
          >
            <Text style={styles.footerButtonText}>Next ›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * `eink` toggles the e-reader rendering for the section cards:
 *  - No card border / no surface background (e-ink can't render subtle
 *    chrome crisply; it washes to mid-grey)
 *  - Section header is a flat heading (no card chrome, no press flash)
 *  - High-contrast chevron + label (palette.textStrong, no muted greys)
 *  - Body flows directly under the header with no border-top divider
 * All other UI (top header, footer nav, progress text) stays the same;
 * those are minor surfaces that already look fine on e-ink.
 */
function makeStyles(p: Palette, eink: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      backgroundColor: p.surface,
    },
    backButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    backArrow: { color: p.accent, fontSize: 28, lineHeight: 28 },
    headerTitle: { flex: 1, marginLeft: 4 },
    headerLabel: {
      color: p.textMuted,
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    headerCrumb: {
      color: p.textMuted,
      fontSize: 11,
      letterSpacing: 1.2,
      fontWeight: "600",
    },
    headerName: { color: p.textStrong, fontSize: 15, fontWeight: "600" },
    body: { flex: 1 },
    bodyInner: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 48 },
    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    controlButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 6,
      backgroundColor: p.surface,
    },
    controlButtonPressed: { backgroundColor: p.surfacePressed },
    controlText: { color: p.text, fontSize: 12, fontWeight: "500" },
    progressText: {
      color: p.textMuted,
      fontSize: 12,
      fontVariant: ["tabular-nums"],
    },
    sectionCard: eink
      ? {
          // Flat layout, separated by whitespace only. No border/chrome and
          // crucially NO full-width divider line — repeating 1px black
          // rules shimmer and tear during scroll (esp. on e-ink partial
          // refresh). The bold uppercase header + this gap carry the
          // section structure instead.
          marginBottom: 18,
        }
      : {
          marginBottom: 10,
          borderWidth: 1,
          borderColor: p.border,
          borderRadius: 8,
          backgroundColor: p.surface,
          overflow: "hidden",
        },
    sectionHeader: eink
      ? {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 0,
          paddingVertical: 8,
          // No borderTop — the divider line caused scroll tearing on e-ink.
        }
      : {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
    // E-ink: no press-state background flash (ghosting). Bubble: tinted
    // surfacePressed for the tap affordance.
    sectionHeaderPressed: eink ? {} : { backgroundColor: p.surfacePressed },
    sectionToggle: eink
      ? {
          color: p.textStrong,
          fontSize: 18,
          fontWeight: "700",
          width: 22,
        }
      : {
          color: p.textMuted,
          fontSize: 14,
          width: 18,
        },
    sectionName: eink
      ? {
          color: p.textStrong,
          fontSize: 18,
          fontWeight: "700",
          flex: 1,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }
      : {
          color: p.textStrong,
          fontSize: 15,
          fontWeight: "600",
          flex: 1,
        },
    sectionBody: eink
      ? {
          paddingHorizontal: 0,
          paddingTop: 4,
          paddingBottom: 16,
        }
      : {
          paddingHorizontal: 14,
          paddingBottom: 14,
          borderTopWidth: 1,
          borderTopColor: p.border,
          backgroundColor: p.bg,
        },
    footerNav: {
      marginTop: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    footerButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 8,
      backgroundColor: p.surface,
    },
    footerButtonText: {
      color: p.accent,
      fontSize: 14,
      fontWeight: "500",
    },
  });
}

function makeMarkdownStyles(p: Palette, scale: number) {
  const fs = (n: number) => n * scale;
  return {
    body: { color: p.text, fontSize: fs(15), lineHeight: fs(22) },
    heading1: {
      color: p.textStrong,
      fontSize: fs(20),
      fontWeight: "700" as const,
      marginTop: 12,
      marginBottom: 8,
    },
    heading2: {
      color: p.textStrong,
      fontSize: fs(17),
      fontWeight: "700" as const,
      marginTop: 12,
      marginBottom: 6,
    },
    heading3: {
      color: p.textStrong,
      fontSize: fs(15),
      fontWeight: "600" as const,
      marginTop: 10,
      marginBottom: 4,
    },
    heading4: {
      color: p.textStrong,
      fontSize: fs(14),
      fontWeight: "600" as const,
      marginTop: 8,
      marginBottom: 2,
    },
    strong: { color: p.textStrong },
    em: {
      color: p.scheme === "light" ? "#6845c0" : "#b8a3ff",
      fontStyle: "italic" as const,
    },
    link: { color: p.accent },
    paragraph: { marginTop: 6, marginBottom: 6 },
    list_item: { marginVertical: 2 },
    bullet_list: { marginVertical: 6 },
    ordered_list: { marginVertical: 6 },
    code_inline: {
      backgroundColor: p.codeBg,
      color: p.accent,
      fontFamily: MONO_FONT,
      fontSize: fs(13),
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
    },
    blockquote: {
      backgroundColor: "transparent",
      borderLeftColor: p.accent,
      borderLeftWidth: 3,
      paddingLeft: 12,
      marginVertical: 6,
    },
    table: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 6,
      marginVertical: 6,
    },
    th: {
      backgroundColor: p.surfacePressed,
      color: p.textStrong,
      fontWeight: "600" as const,
      padding: 6,
    },
    td: { padding: 6, color: p.text },
    hr: { backgroundColor: p.border, height: 1, marginVertical: 12 },
  };
}


// --- write-up conventions -------------------------------------------------
//
// Plain markdown shapes that the reader draws as teaching furniture, so the
// content files stay ordinary markdown and the parser stays untouched:
//   - a paragraph opening **Bad:** / **Good:** / **Great:** is a tiered answer card
//   - a blockquote is a callout
//   - a paragraph that is only a link to /diagram/<id>?focus=a,b,c embeds the
//     diagram cropped and lit to those ids, captioned with the link text
//   - every text run goes through the glossary (plus the diagram's box labels)

type MdNode = {
  key?: string;
  type?: string;
  content?: string;
  children?: MdNode[];
  attributes?: Record<string, string>;
};

function firstStrongText(node: MdNode): string | null {
  const first = node.children?.[0];
  if (!first) return null;
  if (first.type === "strong") return (first.children ?? []).map((c) => c.content ?? "").join("");
  return firstStrongText(first);
}

function soleLink(node: MdNode): MdNode | null {
  let cur: MdNode | undefined = node;
  while (cur && cur.children?.length === 1 && cur.type !== "link") cur = cur.children[0];
  return cur?.type === "link" ? cur : null;
}

const TIERS: Record<string, { fg: string; bg: string }> = {
  Bad: { fg: "#b23a3a", bg: "rgba(178,58,58,0.10)" },
  Good: { fg: "#946200", bg: "rgba(148,98,0,0.10)" },
  Great: { fg: "#1f7a4d", bg: "rgba(31,122,77,0.10)" },
};

function makeRules(p: Palette, terms: Terms | undefined, push: (url: string) => void) {
  return {
    ...markdownRules,
    text: (node: MdNode, _c: unknown, _p: unknown, styles: Record<string, object>, inherited: object = {}) => (
      <GlossedText
        key={node.key}
        text={node.content ?? ""}
        extra={terms}
        style={[inherited, styles.text]}
        accent={p.accent}
        muted={p.textMuted}
      />
    ),
    blockquote: (node: MdNode, children: ReactNode) => (
      <View
        key={node.key}
        style={{
          borderLeftWidth: 3,
          borderLeftColor: p.accent,
          backgroundColor: `${p.accent}14`,
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 8,
          marginVertical: 8,
        }}
      >
        {children}
      </View>
    ),
    paragraph: (node: MdNode, children: ReactNode, _parent: unknown, styles: Record<string, object>) => {
      const strong = firstStrongText(node);
      const tier = strong ? Object.keys(TIERS).find((k) => strong.startsWith(`${k}:`)) : undefined;
      if (tier) {
        const c = TIERS[tier];
        return (
          <View
            key={node.key}
            style={{
              borderLeftWidth: 4,
              borderLeftColor: c.fg,
              backgroundColor: c.bg,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              marginVertical: 6,
            }}
          >
            <Text style={{ color: c.fg, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
              {tier}
            </Text>
            {children}
          </View>
        );
      }
      const link = soleLink(node);
      const href = link?.attributes?.href ?? "";
      const m = href.match(/^\/diagram\/([^/?]+)\?focus=([^&]+)/);
      const d = m ? getDiagram(m[1]) : undefined;
      if (m && d) {
        const caption = (link?.children ?? []).map((c) => c.content ?? "").join("");
        return (
          <View key={node.key} style={{ marginVertical: 10 }}>
            <View style={{ height: 320, borderWidth: 1, borderColor: p.border, borderRadius: 10, overflow: "hidden", backgroundColor: p.surface }}>
              <ArchDiagram diagram={d} palette={p} focus={m[2].split(",")} embedded />
            </View>
            <Text style={{ color: p.textMuted, fontSize: 12.5, marginTop: 6 }}>
              {caption}
              {caption ? " · " : ""}
              <Text style={{ color: p.accent }} onPress={() => push(`/diagram/${d.id}`)}>
                open the full diagram
              </Text>
            </Text>
          </View>
        );
      }
      return (
        <View key={node.key} style={styles._VIEW_SAFE_paragraph}>
          {children}
        </View>
      );
    },
  };
}
