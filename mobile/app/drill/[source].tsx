import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import Markdown from "react-native-markdown-display";
import { useSource } from "../../lib/manifest";
import { useSourceItems } from "../../lib/useSourceItems";
import { markdownRules } from "../../components/CodeBlock";
import {
  cardsFor, filterCards, loadDeck, resetDeck, saveDeck, shuffle, statsFor,
  type Card, type DeckRecords, type Filter, type Label,
} from "../../lib/drill";
import { HARD, MEDIUM, EASY } from "./index";
import { useSettings } from "../../lib/settings";
import { useTheme, MONO_FONT, UI_FONT, type Palette } from "../../lib/theme";

type Phase = "pick" | "card" | "done";

/**
 * A drill session over one source.
 *
 * The card front shows the question ONLY. Its topic and number are held back
 * until reveal, because seeing "Caching" above the question gives the answer
 * away, which would make this a reading exercise rather than a test.
 */
export default function DrillSession() {
  const palette = useTheme();
  const settings = useSettings();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const mdStyles = useMemo(
    () => makeMarkdownStyles(palette, settings.fontScale),
    [palette, settings.fontScale],
  );

  const params = useLocalSearchParams<{ source: string }>();
  const sourceId = params.source ?? "";
  const source = useSource(sourceId);
  const items = useSourceItems(source, true);

  const [recs, setRecs] = useState<DeckRecords>({});
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<Phase>("pick");
  const [queue, setQueue] = useState<Card[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState({ hard: 0, medium: 0, easy: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await loadDeck(sourceId);
      if (cancelled) return;
      setRecs(r);
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [sourceId]);

  const cards = useMemo(() => (items ? cardsFor(items) : []), [items]);
  const stats = useMemo(() => statsFor(cards, recs), [cards, recs]);

  const start = useCallback(
    (f: Filter) => {
      const picked = shuffle(filterCards(cards, recs, f));
      if (!picked.length) return;
      setQueue(picked);
      setI(0);
      setFlipped(false);
      setTally({ hard: 0, medium: 0, easy: 0 });
      setPhase("card");
    },
    [cards, recs],
  );

  const grade = useCallback(
    (label: Label) => {
      const card = queue[i];
      if (!card) return;
      const next = { ...recs, [card.key]: { label, at: Date.now() } };
      setRecs(next);
      if (hydrated) saveDeck(sourceId, next);
      setTally((t) => ({ ...t, [label]: t[label] + 1 }));
      if (i + 1 >= queue.length) setPhase("done");
      else { setI(i + 1); setFlipped(false); }
    },
    [queue, i, recs, hydrated, sourceId],
  );

  // Same keyboard contract the reader already uses: Space reveals, and here
  // 1/2/3 grade. Guarded against text inputs exactly as ItemView does.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.matches?.("input, textarea, [contenteditable='true']")) return;
      if (phase !== "card") return;
      if (e.code === "Space") { e.preventDefault(); setFlipped(true); }
      else if (flipped && ["Digit1", "Digit2", "Digit3"].includes(e.code)) {
        e.preventDefault();
        grade((["hard", "medium", "easy"] as Label[])[Number(e.code.slice(5)) - 1]);
      } else if (e.code === "Escape") { e.preventDefault(); setPhase("pick"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, flipped, grade]);

  if (!source) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>Unknown source “{sourceId}”.</Text>
      </View>
    );
  }

  const header = (title: string, onBack: () => void) => (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.back} accessibilityLabel="Back">
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {phase === "card" ? (
        <Text style={styles.counter}>{i + 1} of {queue.length}</Text>
      ) : (
        <Text style={styles.counter}>{stats.total}</Text>
      )}
    </View>
  );

  if (phase === "pick") {
    const rows: { f: Filter; label: string; n: number; color?: string }[] = [
      { f: "all", label: "Drill all", n: stats.total },
      { f: "hard", label: "Hard", n: stats.hard, color: HARD },
      { f: "medium", label: "Medium", n: stats.medium, color: MEDIUM },
      { f: "easy", label: "Easy", n: stats.easy, color: EASY },
      { f: "new", label: "Not yet seen", n: stats.unseen },
    ];
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: source.title }} />
        {header(source.title, () => router.push("/drill" as never))}
        <ScrollView contentContainerStyle={styles.body}>
          {!items ? (
            <Text style={styles.dim}>Loading…</Text>
          ) : (
            <>
              <View style={styles.stack}>
                {stats.hard > 0 && <View style={{ flex: stats.hard, backgroundColor: HARD }} />}
                {stats.medium > 0 && <View style={{ flex: stats.medium, backgroundColor: MEDIUM }} />}
                {stats.easy > 0 && <View style={{ flex: stats.easy, backgroundColor: EASY }} />}
                {stats.unseen > 0 && <View style={{ flex: stats.unseen, backgroundColor: palette.border }} />}
              </View>
              <Text style={styles.legend}>
                {stats.hard} hard · {stats.medium} medium · {stats.easy} easy
                {stats.unseen ? ` · ${stats.unseen} new` : ""}
              </Text>

              {rows.map((r) => (
                <Pressable
                  key={r.f}
                  disabled={r.n === 0}
                  onPress={() => start(r.f)}
                  style={({ pressed }) => [
                    styles.btn,
                    r.f === "all" && styles.btnPrimary,
                    r.n === 0 && styles.btnDisabled,
                    pressed && r.n > 0 && styles.btnPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnLabel,
                      r.color ? { color: r.color } : null,
                      r.f === "all" ? { color: palette.accent } : null,
                    ]}
                  >
                    {r.label}
                  </Text>
                  <Text style={styles.btnN}>{r.n}</Text>
                </Pressable>
              ))}

              <Pressable
                onPress={async () => {
                  await resetDeck(sourceId);
                  setRecs({});
                }}
                style={styles.reset}
              >
                <Text style={styles.resetText}>↺ Reset this deck</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  if (phase === "done") {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: source.title }} />
        {header("Session complete", () => setPhase("pick"))}
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.deckName}>{source.title}</Text>
          <Text style={styles.legend}>
            {tally.hard + tally.medium + tally.easy} cards reviewed
          </Text>
          <View style={styles.tally}>
            <Tile n={tally.hard} label="hard" color={HARD} styles={styles} />
            <Tile n={tally.medium} label="medium" color={MEDIUM} styles={styles} />
            <Tile n={tally.easy} label="easy" color={EASY} styles={styles} />
          </View>
          {stats.hard > 0 && (
            <Pressable onPress={() => start("hard")} style={[styles.btn, styles.btnPrimary]}>
              <Text style={[styles.btnLabel, { color: palette.accent }]}>
                Drill remaining hard
              </Text>
              <Text style={styles.btnN}>{stats.hard}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setPhase("pick")} style={styles.btn}>
            <Text style={styles.btnLabel}>Back to this deck</Text>
            <Text style={styles.btnN}>→</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/drill" as never)} style={styles.btn}>
            <Text style={styles.btnLabel}>Next weakest deck</Text>
            <Text style={styles.btnN}>→</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const card = queue[i];
  if (!card) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: source.title }} />
      {header(source.title, () => setPhase("pick"))}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.question}>{card.question}</Text>
          {flipped && (
            <>
              <View style={styles.answer}>
                <Markdown style={mdStyles} rules={markdownRules}>
                  {card.answer}
                </Markdown>
              </View>
              <Pressable
                onPress={() =>
                  router.push(`/reader/${sourceId}/${card.itemId}` as never)
                }
                style={styles.src}
              >
                <Text style={styles.srcText} numberOfLines={1}>
                  {card.topic}
                  {card.number ? ` · ${card.number}` : ""}
                </Text>
                <Text style={styles.srcOpen}>Open ↗</Text>
              </Pressable>
            </>
          )}
        </View>

        {flipped ? (
          <View style={styles.grades}>
            <Grade label="Hard" k="1" color={HARD} onPress={() => grade("hard")} styles={styles} />
            <Grade label="Medium" k="2" color={MEDIUM} onPress={() => grade("medium")} styles={styles} />
            <Grade label="Easy" k="3" color={EASY} onPress={() => grade("easy")} styles={styles} />
          </View>
        ) : (
          <Pressable
            onPress={() => setFlipped(true)}
            style={[styles.btn, styles.btnPrimary, { justifyContent: "center", marginTop: 18 }]}
          >
            <Text style={[styles.btnLabel, { color: palette.accent }]}>Show answer</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function Tile({
  n, label, color, styles,
}: { n: number; label: string; color: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileN, { color }]}>{n}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function Grade({
  label, k, color, onPress, styles,
}: {
  label: string; k: string; color: string; onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.grade, pressed && styles.btnPressed]}>
      <Text style={[styles.gradeLabel, { color }]}>{label}</Text>
      <Text style={styles.gradeKey}>{k}</Text>
    </Pressable>
  );
}

function makeMarkdownStyles(p: Palette, scale: number) {
  return {
    body: { color: p.text, fontSize: 14 * scale, fontFamily: UI_FONT },
    code_inline: {
      color: p.codeFg, backgroundColor: p.codeBg, fontFamily: MONO_FONT,
      fontSize: 12.5 * scale, paddingHorizontal: 4, borderRadius: 4,
    },
    fence: { backgroundColor: p.codeBg, borderRadius: 8, padding: 10 },
    strong: { color: p.textStrong, fontWeight: "700" as const },
    bullet_list: { marginTop: 4 },
  };
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: p.bg },
    header: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 12, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: p.border, backgroundColor: p.surface,
    },
    back: { paddingHorizontal: 6, paddingVertical: 2 },
    backGlyph: { color: p.textMuted, fontSize: 22, lineHeight: 24 },
    title: { flex: 1, color: p.textStrong, fontSize: 15, fontWeight: "600" },
    counter: { color: p.textMuted, fontSize: 12, fontFamily: MONO_FONT },
    // Keep the column readable on desktop; the sidebar layout gives this
    // screen the full remaining width, which is far too wide for a card.
    body: {
      padding: 16,
      paddingBottom: 48,
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
    },
    dim: { color: p.textMuted, fontSize: 14 },
    stack: {
      flexDirection: "row", height: 7, borderRadius: 4, overflow: "hidden",
      marginBottom: 6, backgroundColor: p.border,
    },
    legend: { color: p.textMuted, fontSize: 11.5, fontFamily: MONO_FONT, marginBottom: 18 },
    deckName: { color: p.textStrong, fontSize: 16, fontWeight: "600" },
    btn: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 14, paddingVertical: 13, borderRadius: 10,
      borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, marginBottom: 8,
    },
    btnPrimary: { borderColor: p.accent },
    btnPressed: { backgroundColor: p.surfacePressed },
    btnDisabled: { opacity: 0.4 },
    btnLabel: { color: p.textStrong, fontSize: 14, fontWeight: "600" },
    btnN: { color: p.textMuted, fontSize: 12.5, fontFamily: MONO_FONT },
    reset: { marginTop: 14, paddingVertical: 6 },
    resetText: { color: p.textMuted, fontSize: 13 },
    card: {
      borderWidth: 1, borderColor: p.border, backgroundColor: p.surface,
      borderRadius: 12, padding: 18,
    },
    question: { color: p.textStrong, fontSize: 17, fontWeight: "600", lineHeight: 24 },
    answer: { marginTop: 12 },
    src: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
      marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: p.border,
    },
    srcText: { color: p.textMuted, fontSize: 12, fontFamily: MONO_FONT, flexShrink: 1 },
    srcOpen: { color: p.accent, fontSize: 12 },
    grades: { flexDirection: "row", gap: 8, marginTop: 18 },
    grade: {
      flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10,
      borderWidth: 1, borderColor: p.border, backgroundColor: p.surface,
    },
    gradeLabel: { fontSize: 14, fontWeight: "600" },
    gradeKey: { color: p.textMuted, fontSize: 10.5, fontFamily: MONO_FONT, marginTop: 3 },
    tally: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 20 },
    tile: {
      flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10,
      borderWidth: 1, borderColor: p.border, backgroundColor: p.surface,
    },
    tileN: { fontSize: 22, fontFamily: MONO_FONT },
    tileLabel: { color: p.textMuted, fontSize: 11 },
  });
}
