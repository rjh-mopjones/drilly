import { useLocalSearchParams, Stack, router } from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import ArchDiagram from "../../components/ArchDiagram";
import { getDiagram, itemRoute } from "../../lib/diagrams";
import { loadSource } from "../../lib/content";
import { useSource } from "../../lib/manifest";
import { parseContent, type Pattern } from "../../lib/parser";
import { useTheme, type Palette } from "../../lib/theme";

/**
 * A system-design question opens here: the interactive diagram is the answer,
 * with Overview (the learning walk) and Deep dive (the write-up) beside it.
 * Prev / next step through the source's questions in order; a neighbour
 * without a diagram opens in the reader.
 */
export default function DiagramScreen() {
  const palette = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const params = useLocalSearchParams<{ id: string }>();
  const diagram = getDiagram(params.id ?? "");
  const source = useSource(diagram?.sourceId ?? "");

  const [items, setItems] = useState<Pattern[] | null>(null);
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    (async () => {
      try {
        const md = await loadSource(source);
        if (!cancelled) setItems(parseContent(md, source));
      } catch {
        // Navigation degrades to "no prev/next"; the diagram itself needs nothing loaded.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  const neighbour = useCallback(
    (delta: 1 | -1) => {
      if (!items || !diagram) return;
      const idx = items.findIndex((it) => it.id === diagram.itemId);
      const target = items[idx + delta];
      if (target) router.replace(itemRoute(diagram.sourceId, target.id) as never);
    },
    [items, diagram],
  );

  if (!diagram) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Diagram" }} />
        <Text style={styles.missing}>No diagram named “{params.id}”.</Text>
      </View>
    );
  }

  const idx = items?.findIndex((it) => it.id === diagram.itemId) ?? -1;
  const hasPrev = idx > 0;
  const hasNext = items != null && idx >= 0 && idx < items.length - 1;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: diagram.title }} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push(`/source/${diagram.sourceId}` as never)}
          style={styles.backButton}
          accessibilityLabel={`Back to ${source?.title ?? "questions"}`}
        >
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.crumb} numberOfLines={1}>
            {(source?.title ?? "").toUpperCase()}
            {source ? ` · ${source.itemLabel} ${diagram.itemId}` : ""}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {diagram.question}
          </Text>
        </View>
        <View style={styles.nav}>
          <Pressable
            onPress={() => neighbour(-1)}
            disabled={!hasPrev}
            style={[styles.navButton, !hasPrev && styles.navDisabled]}
            accessibilityLabel="Previous question"
          >
            <Text style={styles.navText}>‹ Prev</Text>
          </Pressable>
          <Pressable
            onPress={() => neighbour(1)}
            disabled={!hasNext}
            style={[styles.navButton, !hasNext && styles.navDisabled]}
            accessibilityLabel="Next question"
          >
            <Text style={styles.navText}>Next ›</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.canvas}>
        <ArchDiagram
          diagram={diagram}
          palette={palette}
          onDeepDive={() => router.push(`/reader/${diagram.sourceId}/${diagram.itemId}` as never)}
        />
      </View>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      backgroundColor: p.surface,
    },
    backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    backArrow: { color: p.accent, fontSize: 28, lineHeight: 28 },
    headerTitle: { flex: 1, minWidth: 0 },
    crumb: { color: p.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: "600" },
    subtitle: { color: p.textStrong, fontSize: 14, fontWeight: "600" },
    nav: { flexDirection: "row", gap: 6 },
    navButton: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
    },
    navDisabled: { opacity: 0.35 },
    navText: { color: p.accent, fontSize: 13, fontWeight: "600" },
    canvas: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: p.bg },
    missing: { color: p.textMuted, fontSize: 14 },
  });
}
