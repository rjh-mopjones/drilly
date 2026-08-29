import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useManifest } from "../lib/manifest";
import { openExternalSource } from "../lib/content";
import type { SourceConfig } from "../lib/parser";
import { useTheme, type Palette } from "../lib/theme";
import { SourceCard } from "./SourceCard";
import { RefreshAllButton } from "./RefreshAllButton";
import { ChevronsIcon } from "./ChevronsIcon";

/**
 * Group manifest sources by their `category` field, preserving manifest
 * order within each group. Sources without a category fall under "Other".
 * Returns an ordered array of (category, sources) so the home library
 * can render category headers + nested cards in a single pass.
 */
function groupByCategory(
  sources: SourceConfig[],
): Array<{ category: string; sources: SourceConfig[] }> {
  const order: string[] = [];
  const buckets = new Map<string, SourceConfig[]>();
  for (const s of sources) {
    const cat = s.category?.trim() || "Other";
    if (!buckets.has(cat)) {
      order.push(cat);
      buckets.set(cat, []);
    }
    buckets.get(cat)!.push(s);
  }
  return order.map((category) => ({
    category,
    sources: buckets.get(category)!,
  }));
}

/**
 * Home screen — vertical list of source cards. Replaces the bottom chip
 * strip; tap a card to drill into that source's items, tap ⚙ to open
 * Settings. Pull-to-refresh refreshes only the manifest (cheap) — content
 * refresh stays on the per-source view.
 */
export function SourceLibrary() {
  const palette = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { sources, refresh } = useManifest();
  const grouped = useMemo(() => groupByCategory(sources), [sources]);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const didInitCollapse = useRef(false);

  // Every category starts collapsed on first load, once the manifest has
  // populated the tree. Runs a single time — the user's toggles win after
  // that, and collapse/expand-all stay available.
  useEffect(() => {
    if (didInitCollapse.current || grouped.length === 0) return;
    didInitCollapse.current = true;
    setCollapsed(new Set(grouped.map((g) => g.category)));
  }, [grouped]);

  const toggleCategory = useCallback((category: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);
  const collapseAll = useCallback(
    () => setCollapsed(new Set(grouped.map((g) => g.category))),
    [grouped],
  );
  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // Manifest refresh is best-effort — bundled fallback keeps the UI alive.
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.accent}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>DRILLY</Text>
          <Text style={styles.brandSub}>
            {sources.length} {sources.length === 1 ? "source" : "sources"}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push("/drill" as never)}
            style={styles.cog}
            accessibilityLabel="Drill"
          >
            <ChevronsIcon size={22} color={palette.drill} />
          </Pressable>
          <RefreshAllButton />
          <Pressable
            onPress={() => router.push("/settings")}
            style={styles.cog}
            accessibilityLabel="Settings"
          >
            <Text style={styles.cogText}>⚙</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.collapseBar}>
        <Pressable
          onPress={collapseAll}
          style={styles.collapseBtn}
          accessibilityLabel="Collapse all sections"
        >
          <Text style={styles.collapseBtnText}>▸ Collapse all</Text>
        </Pressable>
        <Pressable
          onPress={expandAll}
          style={styles.collapseBtn}
          accessibilityLabel="Expand all sections"
        >
          <Text style={styles.collapseBtnText}>▾ Expand all</Text>
        </Pressable>
      </View>

      {grouped.map(({ category, sources: groupSources }) => {
        const isCollapsed = collapsed.has(category);
        return (
          <View key={category} style={styles.group}>
            <Pressable
              onPress={() => toggleCategory(category)}
              style={({ pressed }) => [
                styles.groupHeaderRow,
                pressed && styles.groupHeaderPressed,
              ]}
              accessibilityLabel={`${isCollapsed ? "Expand" : "Collapse"} ${category}`}
            >
              <Text style={styles.groupToggle}>{isCollapsed ? "▸" : "▾"}</Text>
              <Text style={styles.groupHeader}>{category}</Text>
            </Pressable>
            {!isCollapsed &&
              groupSources.map((s) => (
                <SourceCard
                  key={s.id}
                  source={s}
                  onPress={() =>
                    s.externalUrl
                      ? openExternalSource(s.externalUrl)
                      : router.push(`/source/${s.id}`)
                  }
                />
              ))}
          </View>
        );
      })}

      <View style={styles.footer} />
    </ScrollView>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.bg },
    content: { paddingBottom: 32 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
    },
    headerLeft: { flex: 1 },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    brand: {
      color: p.textStrong,
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: 1.5,
    },
    brandSub: {
      color: p.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    cog: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 22,
    },
    cogText: {
      color: p.textMuted,
      fontSize: 22,
    },
    group: {
      marginTop: 12,
    },
    collapseBar: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 12,
      paddingTop: 10,
    },
    collapseBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    collapseBtnText: {
      color: p.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    // Section eyebrow — legible near-body caps (was tiny muted grey) with a
    // finger-sized tap target, matching the desktop sidebar treatment.
    groupHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    groupHeaderPressed: { backgroundColor: p.surfacePressed },
    groupToggle: {
      color: p.textMuted,
      fontSize: 13,
      width: 16,
      textAlign: "center",
    },
    groupHeader: {
      color: p.text,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    footer: { height: 32 },
  });
}
