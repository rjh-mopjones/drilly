import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useManifest } from "../lib/manifest";
import { refreshSource, warmExternalCaches, openExternalSource } from "../lib/content";
import {
  formatRelativeTime,
  getLastFullRefresh,
  setLastFullRefresh,
  setLastRefreshed,
} from "../lib/storage";
import type { SourceConfig } from "../lib/parser";
import { invalidateSourceItemsCache, useSourceItems } from "../lib/useSourceItems";
import { useTheme, type Palette } from "../lib/theme";

const SIDEBAR_WIDTH = 300;

/**
 * True when a Pressable is pressed or hovered. `hovered` is a
 * react-native-web extension not present in the base RN state type, so we
 * accept it as an optional field (always false/undefined on native).
 */
const isHot = (s: { pressed: boolean; hovered?: boolean }) =>
  s.pressed || !!s.hovered;

/**
 * Group sources by their `category` field while preserving manifest order.
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
  return order.map((c) => ({ category: c, sources: buckets.get(c)! }));
}

/**
 * Persistent left sidebar on desktop web (see _layout.tsx).
 *
 * Tree:
 *   CATEGORY
 *     ▸ Source        (collapsed)
 *     ▾ Source        (expanded)
 *         1. Item
 *         2. Item
 *         …
 *
 * Source expansion is local sidebar state; the active source's tree
 * auto-opens when the URL points at one of its items.
 */
export function DesktopSidebar() {
  const palette = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { sources, refresh } = useManifest();
  const grouped = useMemo(() => groupByCategory(sources), [sources]);
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [refreshedLabel, setRefreshedLabel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  /**
   * Collapsed category names. Every category starts collapsed on first load
   * (see the init effect below) so a fresh visit shows a compact list of
   * section headers; the user expands what they care about.
   */
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    () => new Set(),
  );
  const didInitCollapse = useRef(false);

  // Hydrate the "Updated …" label.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ts = await getLastFullRefresh();
      if (!cancelled) setRefreshedLabel(ts ? formatRelativeTime(ts) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // URL parsing: matches both /source/[id] and /reader/[source]/[itemId].
  const { activeSourceId, activeItemId } = useMemo(() => {
    const m = pathname.match(/^\/(?:source|reader)\/([^/]+)(?:\/(\d+))?/);
    return {
      activeSourceId: m ? m[1] : null,
      activeItemId: m && m[2] ? Number(m[2]) : null,
    };
  }, [pathname]);

  // Collapse every category by default, once the manifest has populated the
  // tree. Runs a single time — after that the user's toggles win, and
  // collapse/expand-all stay available. On a deep-link we leave the active
  // source's category expanded so the sidebar doesn't hide where you are.
  useEffect(() => {
    if (didInitCollapse.current || grouped.length === 0) return;
    didInitCollapse.current = true;
    const activeCategory = activeSourceId
      ? sources.find((s) => s.id === activeSourceId)?.category
      : null;
    setCollapsedCategories(
      new Set(
        grouped
          .map((g) => g.category)
          .filter((category) => category !== activeCategory),
      ),
    );
  }, [grouped, activeSourceId, sources]);

  // Auto-expand the source tree whenever the URL points at one of its items.
  useEffect(() => {
    if (!activeSourceId) return;
    setExpanded((prev) => {
      if (prev.has(activeSourceId)) return prev;
      const next = new Set(prev);
      next.add(activeSourceId);
      return next;
    });
  }, [activeSourceId]);

  const toggleSource = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  // Collapse / expand every category section at once.
  const collapseAll = useCallback(() => {
    setCollapsedCategories(new Set(grouped.map((g) => g.category)));
  }, [grouped]);
  const expandAll = useCallback(() => {
    setCollapsedCategories(new Set());
  }, []);

  const onRefresh = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.all([
        refresh().catch(() => {}),
        ...sources.map((s) => refreshSource(s).catch(() => {})),
        warmExternalCaches(),
      ]);
      invalidateSourceItemsCache(); // re-parse on next expand
      const now = Date.now();
      await setLastFullRefresh(now);
      await Promise.all(sources.map((s) => setLastRefreshed(s.id, now)));
      setRefreshedLabel(formatRelativeTime(now));
    } finally {
      setBusy(false);
    }
  }, [busy, sources, refresh]);

  return (
    <View style={styles.sidebar}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push("/")}
          style={styles.brandBlock}
          accessibilityLabel="Home"
        >
          <Text style={styles.brand}>DRILLY</Text>
          <Text style={styles.brandSub}>
            {sources.length} {sources.length === 1 ? "source" : "sources"}
            {refreshedLabel ? ` · Updated ${refreshedLabel}` : ""}
          </Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            onPress={onRefresh}
            disabled={busy}
            style={styles.iconButton}
            accessibilityLabel="Refresh all sources"
          >
            {busy ? (
              <ActivityIndicator color={palette.textMuted} size="small" />
            ) : (
              <Text style={styles.iconGlyph}>↻</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push("/settings")}
            style={styles.iconButton}
            accessibilityLabel="Settings"
          >
            <Text style={styles.iconGlyph}>⚙</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.collapseBar}>
        <Pressable
          onPress={collapseAll}
          style={(s) => [styles.collapseBtn, isHot(s) && styles.sourceRowPressed]}
          accessibilityLabel="Collapse all sections"
        >
          <Text style={styles.collapseBtnText}>▸ Collapse all</Text>
        </Pressable>
        <Pressable
          onPress={expandAll}
          style={(s) => [styles.collapseBtn, isHot(s) && styles.sourceRowPressed]}
          accessibilityLabel="Expand all sections"
        >
          <Text style={styles.collapseBtnText}>▾ Expand all</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner}>
        {grouped.map(({ category, sources: groupSources }) => {
          const collapsed = collapsedCategories.has(category);
          return (
            <View key={category} style={styles.group}>
              <Pressable
                onPress={() => toggleCategory(category)}
                style={(s) => [
                  styles.groupHeaderRow,
                  isHot(s) && styles.sourceRowPressed,
                ]}
                accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${category}`}
              >
                <Text style={styles.groupToggle}>{collapsed ? "▸" : "▾"}</Text>
                <Text style={styles.groupHeader}>{category}</Text>
              </Pressable>
              {!collapsed &&
                groupSources.map((s) => (
                  <SourceTreeNode
                    key={s.id}
                    source={s}
                    expanded={expanded.has(s.id)}
                    onToggle={() => toggleSource(s.id)}
                    activeSourceId={activeSourceId}
                    activeItemId={activeItemId}
                    palette={palette}
                  />
                ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface SourceTreeNodeProps {
  source: SourceConfig;
  expanded: boolean;
  onToggle: () => void;
  activeSourceId: string | null;
  activeItemId: number | null;
  palette: Palette;
}

function SourceTreeNode({
  source,
  expanded,
  onToggle,
  activeSourceId,
  activeItemId,
  palette,
}: SourceTreeNodeProps) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const isExternal = !!source.externalUrl;
  const items = useSourceItems(source, expanded && !isExternal);
  const active = source.id === activeSourceId;

  return (
    <View>
      <Pressable
        onPress={
          isExternal ? () => openExternalSource(source.externalUrl!) : onToggle
        }
        style={(s) => [
          styles.sourceRow,
          isHot(s) && styles.sourceRowPressed,
          active && styles.sourceRowActive,
        ]}
      >
        <Text style={styles.toggleGlyph}>
          {isExternal ? "↗" : expanded ? "▾" : "▸"}
        </Text>
        <Text
          style={[styles.sourceTitle, active && styles.sourceTitleActive]}
          numberOfLines={1}
        >
          {source.title}
        </Text>
        {typeof source.itemCount === "number" && !isExternal && (
          <Text style={styles.sourceCount}>{source.itemCount}</Text>
        )}
      </Pressable>

      {expanded && !isExternal && (
        <View style={styles.itemsList}>
          {items && items.length > 0 && (
            <View
              style={[styles.rail, source.cheatSheetUrl ? { bottom: 46 } : null]}
              pointerEvents="none"
            />
          )}
          {items === null ? (
            <Text style={styles.itemsHint}>Loading…</Text>
          ) : items.length === 0 ? (
            <Text style={styles.itemsHint}>No items</Text>
          ) : (
            items.map((it) => {
              const isActiveItem =
                active && activeItemId !== null && activeItemId === it.id;
              return (
                <Pressable
                  key={it.id}
                  onPress={() => router.push(`/reader/${source.id}/${it.id}`)}
                  style={(s) => [
                    styles.itemRow,
                    isHot(s) && styles.sourceRowPressed,
                    isActiveItem && styles.sourceRowActive,
                  ]}
                >
                  {isActiveItem && (
                    <View style={styles.itemRailActive} pointerEvents="none" />
                  )}
                  <Text style={styles.itemNumber}>{it.id}</Text>
                  <Text
                    style={[
                      styles.itemTitle,
                      isActiveItem && styles.sourceTitleActive,
                    ]}
                    numberOfLines={2}
                  >
                    {it.title}
                  </Text>
                </Pressable>
              );
            })
          )}
          {/* Pinned last item: the printable A4 cheat sheet (opens externally). */}
          {source.cheatSheetUrl && (
            <Pressable
              onPress={() => openExternalSource(source.cheatSheetUrl!)}
              style={(s) => [
                styles.itemRow,
                styles.cheatRow,
                isHot(s) && styles.sourceRowPressed,
              ]}
              accessibilityLabel="Open printable cheat sheet"
            >
              <Text style={[styles.itemNumber, styles.cheatGlyph]}>▤</Text>
              <Text style={[styles.itemTitle, styles.cheatItemTitle]} numberOfLines={1}>
                Cheat Sheet ↗
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    sidebar: {
      width: SIDEBAR_WIDTH,
      backgroundColor: p.surface,
      borderRightWidth: 1,
      borderRightColor: p.border,
      flexDirection: "column",
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
    },
    brandBlock: { flex: 1, paddingRight: 8 },
    brand: {
      color: p.textStrong,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: 1.3,
    },
    brandSub: {
      color: p.textMuted,
      fontSize: 11,
      marginTop: 4,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    iconButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
    },
    iconGlyph: {
      color: p.textMuted,
      fontSize: 18,
      lineHeight: 20,
    },
    collapseBar: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
    },
    collapseBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    collapseBtnText: {
      color: p.textMuted,
      fontSize: 11,
      fontWeight: "600",
    },
    body: { flex: 1 },
    bodyInner: { paddingVertical: 8 },
    group: { paddingTop: 2, paddingBottom: 2 },
    // Top tier — the section eyebrow (e.g. "SYSTEM FUNDAMENTALS"). Legible
    // caps, near-body colour (not the old tiny muted grey), for tier signal.
    groupHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 40,
      paddingLeft: 14,
      paddingRight: 16,
      paddingTop: 10,
      paddingBottom: 6,
      gap: 6,
    },
    groupToggle: {
      color: p.textMuted,
      fontSize: 11,
      width: 14,
      textAlign: "center",
    },
    groupHeader: {
      color: p.text,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    // Middle tier — the category (a source, e.g. "Operating Systems"). Bold
    // sans, bigger, with a right-aligned topic count.
    // Indented one step right of the section eyebrow (14) so the tiers read
    // as a tree: section -> category -> topic.
    sourceRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      paddingLeft: 26,
      paddingRight: 14,
      paddingVertical: 9,
      gap: 6,
    },
    sourceRowPressed: { backgroundColor: p.surfacePressed },
    sourceRowActive: { backgroundColor: p.surfacePressed },
    toggleGlyph: {
      color: p.textMuted,
      fontSize: 12,
      width: 14,
      textAlign: "center",
    },
    sourceTitle: {
      color: p.text,
      fontSize: 15,
      fontWeight: "600",
      flex: 1,
    },
    sourceTitleActive: {
      color: p.textStrong,
      fontWeight: "700",
    },
    sourceCount: {
      color: p.textMuted,
      fontSize: 11,
      fontVariant: ["tabular-nums"],
      marginLeft: 8,
    },
    // Bottom tier — numbered topics, connected by a vertical rail (spine).
    itemsList: { position: "relative", paddingBottom: 6 },
    rail: {
      position: "absolute",
      left: 34,
      top: 2,
      bottom: 8,
      width: 1.5,
      backgroundColor: p.border,
      borderRadius: 1,
    },
    itemsHint: {
      color: p.textMuted,
      fontSize: 12,
      paddingLeft: 44,
      paddingVertical: 6,
      fontStyle: "italic",
    },
    itemRow: {
      position: "relative",
      flexDirection: "row",
      alignItems: "flex-start",
      minHeight: 38,
      paddingVertical: 8,
      paddingLeft: 44,
      paddingRight: 12,
      gap: 9,
    },
    // Brighter rail segment marking the active topic, sitting over the spine.
    itemRailActive: {
      position: "absolute",
      left: 33,
      top: 7,
      bottom: 7,
      width: 2.5,
      backgroundColor: p.textMuted,
      borderRadius: 2,
    },
    itemNumber: {
      color: p.textMuted,
      fontSize: 11,
      fontVariant: ["tabular-nums"],
      width: 20,
      textAlign: "right",
      marginTop: 2,
    },
    itemTitle: {
      color: p.text,
      fontSize: 13.5,
      lineHeight: 18,
      flex: 1,
    },
    // Pinned cheat-sheet link — neutral (no blue), set off by a top divider.
    cheatRow: {
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: p.border,
    },
    cheatGlyph: {
      color: p.textMuted,
    },
    cheatItemTitle: {
      color: p.text,
      fontWeight: "600",
    },
  });
}

export const DESKTOP_SIDEBAR_WIDTH = SIDEBAR_WIDTH;
