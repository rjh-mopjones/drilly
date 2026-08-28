import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { useManifest } from "../../lib/manifest";
import { loadDeck, statsFor, type DeckStats } from "../../lib/drill";
import { useTheme, MONO_FONT, type Palette } from "../../lib/theme";

/**
 * Drill deck list — every drillable source, weakest known first.
 *
 * Card totals come from `drillCards` in the manifest (see
 * scripts/backfill-drill-counts.ts) rather than from parsing: opening this
 * screen must not cost ~50 markdown parses. Sources without that field are not
 * question-shaped and never appear.
 */
export default function DrillIndex() {
  const palette = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { sources } = useManifest();
  const { width } = useWindowDimensions();
  // The desktop sidebar carries its own settings icon, so a second one in this
  // header is a duplicate. Same width check as app/settings.tsx.
  const isDesktop = Platform.OS === "web" && width >= 900;
  const [stats, setStats] = useState<Record<string, DeckStats>>({});

  const decks = useMemo(
    () => sources.filter((s) => typeof s.drillCards === "number" && s.drillCards > 0),
    [sources],
  );

  // Re-read on focus so returning from a session shows the new numbers.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const next: Record<string, DeckStats> = {};
        for (const s of decks) {
          const recs = await loadDeck(s.id);
          const total = s.drillCards ?? 0;
          let hard = 0, medium = 0, easy = 0;
          for (const r of Object.values(recs)) {
            if (r.label === "hard") hard++;
            else if (r.label === "medium") medium++;
            else easy++;
          }
          next[s.id] = {
            total, hard, medium, easy,
            unseen: Math.max(0, total - hard - medium - easy),
            mastery: total ? (easy + medium * 0.5) / total : 0,
          };
        }
        if (!cancelled) setStats(next);
      })();
      return () => { cancelled = true; };
    }, [decks]),
  );

  // Weakest-first, but only among decks actually attempted. Ranking on mastery
  // alone put untouched decks at the top: mastery is 0 both for a deck of
  // all-hards and for one never opened, so the two tied and manifest order
  // broke the tie. Weakness is instead the weighted count of what you got
  // wrong (hard = 1, medium = 0.5), and an unattempted deck scores -1 so it
  // sorts below every attempted one — there is nothing known to be weak in it.
  const ordered = useMemo(() => {
    const weakness = (id: string) => {
      const st = stats[id];
      if (!st) return UNATTEMPTED;
      const seen = st.hard + st.medium + st.easy;
      return seen ? st.hard + st.medium * 0.5 : UNATTEMPTED;
    };
    return decks
      .map((s, i) => ({ s, i, w: weakness(s.id) }))
      .sort((a, b) => b.w - a.w || a.i - b.i)
      .map((x) => x.s);
  }, [decks, stats]);

  const totalCards = decks.reduce((n, s) => n + (s.drillCards ?? 0), 0);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Drill" }} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push("/")}
          style={styles.back}
          accessibilityLabel="Back to library"
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Drill</Text>
        {!isDesktop && (
          <Pressable
            onPress={() => router.push("/settings")}
            style={styles.icon}
            accessibilityLabel="Settings"
          >
            <Text style={styles.iconGlyph}>⚙</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.meta}>
          {decks.length} decks · {totalCards.toLocaleString()} cards
        </Text>

        {ordered.map((s) => {
          const st = stats[s.id];
          const total = s.drillCards ?? 0;
          return (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/drill/${s.id}` as never)}
              style={({ pressed }) => [styles.deck, pressed && styles.deckPressed]}
            >
              <View style={styles.deckTop}>
                <Text style={styles.deckName}>{s.title}</Text>
                <Text style={styles.deckCount}>{total}</Text>
              </View>
              <View style={styles.stack}>
                <Seg n={st?.hard ?? 0} total={total} color={HARD} />
                <Seg n={st?.medium ?? 0} total={total} color={MEDIUM} />
                <Seg n={st?.easy ?? 0} total={total} color={EASY} />
                <Seg n={st?.unseen ?? total} total={total} color={palette.border} />
              </View>
              <Text style={styles.legend}>
                {st && st.hard + st.medium + st.easy > 0
                  ? `${st.hard} hard · ${st.medium} medium · ${st.easy} easy` +
                    (st.unseen ? ` · ${st.unseen} new` : "")
                  : `${total} not yet seen`}
              </Text>
            </Pressable>
          );
        })}

        <View style={styles.key}>
          <Key color={HARD} label="hard" styles={styles} />
          <Key color={MEDIUM} label="medium" styles={styles} />
          <Key color={EASY} label="easy" styles={styles} />
          <Key color={palette.border} label="not seen" styles={styles} />
        </View>
      </ScrollView>
    </View>
  );
}

// Sentinel rank for a deck with no labels at all, below every real weakness
// score (the lowest of which is 0, an attempted deck graded entirely easy).
const UNATTEMPTED = -1;

export const HARD = "#f2777a";
export const MEDIUM = "#fbbf24";
export const EASY = "#6ee7a8";

function Seg({ n, total, color }: { n: number; total: number; color: string }) {
  if (!n || !total) return null;
  return <View style={{ flex: n / total, backgroundColor: color }} />;
}

function Key({
  color,
  label,
  styles,
}: {
  color: string;
  label: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.keyItem}>
      <View style={[styles.sw, { backgroundColor: color }]} />
      <Text style={styles.keyText}>{label}</Text>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      backgroundColor: p.surface,
    },
    back: { paddingHorizontal: 6, paddingVertical: 2 },
    backGlyph: { color: p.textMuted, fontSize: 22, lineHeight: 24 },
    title: { flex: 1, color: p.textStrong, fontSize: 16, fontWeight: "700" },
    icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    iconGlyph: { color: p.textMuted, fontSize: 18 },
    // Keep the column readable on desktop; the sidebar layout gives this
    // screen the full remaining width, which is far too wide for a card.
    body: {
      padding: 16,
      paddingBottom: 48,
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
    },
    meta: {
      color: p.textMuted,
      fontSize: 12,
      fontFamily: MONO_FONT,
      marginBottom: 14,
    },
    deck: { padding: 11, borderRadius: 10, marginBottom: 2 },
    deckPressed: { backgroundColor: p.surfacePressed },
    deckTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
    deckName: { color: p.textStrong, fontSize: 15, fontWeight: "600", flexShrink: 1 },
    deckCount: { color: p.textMuted, fontSize: 12, fontFamily: MONO_FONT },
    stack: {
      flexDirection: "row",
      height: 7,
      borderRadius: 4,
      overflow: "hidden",
      marginTop: 8,
      marginBottom: 6,
      backgroundColor: p.border,
    },
    legend: { color: p.textMuted, fontSize: 11, fontFamily: MONO_FONT },
    key: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 14,
      marginTop: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: p.border,
    },
    keyItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    sw: { width: 9, height: 9, borderRadius: 2 },
    keyText: { color: p.textMuted, fontSize: 11.5 },
  });
}
