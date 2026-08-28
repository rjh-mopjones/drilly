import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { loadDeck, saveDeck, type DeckRecords } from "../lib/drill";
import {
  explode, getLastSynced, getWord, lookup, mergeRecords, normalise, push,
  setWord, wordError, MIN_WORD,
} from "../lib/drillSync";
import { useManifest } from "../lib/manifest";
import { useTheme, MONO_FONT, type Palette } from "../lib/theme";
import { formatRelativeTime } from "../lib/storage";

type Mode = "off" | "claim" | "connect" | "on";

/**
 * Settings → Sync.
 *
 * Ephemeral by default: progress lives on this device until you attach a word.
 * The word is the whole credential, so it is normalised everywhere and the
 * warning about that is stated plainly rather than buried.
 */
export function DrillSyncSection() {
  const palette = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { sources } = useManifest();

  const [mode, setMode] = useState<Mode>("off");
  const [word, setWordInput] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [remote, setRemote] = useState<{ exists: boolean; cards?: number } | null>(null);
  const [localCards, setLocalCards] = useState(0);
  const [synced, setSynced] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deckIds = useMemo(
    () => sources.filter((s) => typeof s.drillCards === "number").map((s) => s.id),
    [sources],
  );

  const readAll = useCallback(async () => {
    const all: Record<string, DeckRecords> = {};
    let n = 0;
    for (const id of deckIds) {
      const r = await loadDeck(id);
      if (Object.keys(r).length) {
        all[id] = r;
        n += Object.keys(r).length;
      }
    }
    return { all, n };
  }, [deckIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const w = await getWord();
      const s = await getLastSynced();
      const { n } = await readAll();
      if (cancelled) return;
      setSaved(w);
      setSynced(s);
      setLocalCards(n);
      setMode(w ? "on" : "off");
    })();
    return () => { cancelled = true; };
  }, [readAll]);

  // Debounced availability / existence check. One call serves both flows,
  // because with a single credential they are the same question.
  useEffect(() => {
    const n = normalise(word);
    if (mode !== "claim" && mode !== "connect") return;
    if (n.length < MIN_WORD || wordError(n)) { setRemote(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await lookup(n);
        if (!cancelled) { setRemote(r); setError(null); }
      } catch (e) {
        if (!cancelled) { setRemote(null); setError((e as Error).message); }
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [word, mode]);

  const finish = useCallback(
    async (strategy: "merge" | "replace" | "new") => {
      const n = normalise(word);
      setBusy(true);
      setError(null);
      try {
        if (strategy !== "new") {
          const r = await lookup(n);
          const theirs = explode((r.data ?? {}) as never);
          for (const id of new Set([...deckIds, ...Object.keys(theirs)])) {
            const mine = await loadDeck(id);
            const next =
              strategy === "replace" ? (theirs[id] ?? {}) : mergeRecords(mine, theirs[id] ?? {});
            await saveDeck(id, next);
          }
        }
        const { all, n: count } = await readAll();
        await push(n, all);
        await setWord(n);
        setSaved(n);
        setLocalCards(count);
        setSynced(Date.now());
        setMode("on");
        setWordInput("");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [word, deckIds, readAll],
  );

  const syncNow = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { all, n } = await readAll();
      await push(saved, all);
      setLocalCards(n);
      setSynced(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [saved, readAll]);

  const n = normalise(word);
  const lenErr = wordError(word);
  const ready = n.length >= MIN_WORD && !lenErr;
  const showNorm = word.length > 0 && word !== n;

  const field = (placeholder: string) => (
    <>
      <TextInput
        value={word}
        onChangeText={setWordInput}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <Text style={styles.hintLine}>
        {word.length === 0 ? (
          <Text style={styles.mut}>{MIN_WORD} characters minimum</Text>
        ) : lenErr ? (
          <Text style={styles.bad}>{lenErr}</Text>
        ) : !remote ? (
          <Text style={styles.mut}>Checking…</Text>
        ) : mode === "claim" ? (
          remote.exists ? (
            <Text style={styles.bad}>“{n}” is taken. Try another.</Text>
          ) : (
            <Text style={styles.good}>“{n}” is available</Text>
          )
        ) : remote.exists ? (
          <Text style={styles.good}>Found — {remote.cards} cards</Text>
        ) : (
          <Text style={styles.bad}>No progress saved under “{n}”</Text>
        )}
      </Text>
      {showNorm ? (
        <Text style={styles.norm}>
          {mode === "claim" ? "saved as " : "looking up "}
          <Text style={styles.normStrong}>{n}</Text>
        </Text>
      ) : null}
    </>
  );

  return (
    <View>
      {mode === "off" && (
        <>
          <Text style={styles.hint}>
            Progress is saved on this device only. Add a word to share it with
            your other devices and the app.
          </Text>
          <Pressable onPress={() => { setMode("claim"); setRemote(null); }} style={styles.button}>
            <Text style={styles.buttonText}>Track my progress</Text>
          </Pressable>
          <Pressable onPress={() => { setMode("connect"); setRemote(null); }} style={styles.button}>
            <Text style={styles.buttonText}>I already have a word</Text>
          </Pressable>
        </>
      )}

      {mode === "claim" && (
        <>
          <Text style={styles.hint}>
            Pick a memorable word. You will type it on your other devices.
          </Text>
          {field("e.g. quiet-harbour-42")}
          <View style={styles.row}>
            <Pressable
              disabled={!ready || busy || remote?.exists !== false}
              onPress={() => finish("new")}
              style={[styles.button, styles.accent, (!ready || remote?.exists !== false) && styles.disabled]}
            >
              <Text style={[styles.buttonText, styles.accentText]}>Start tracking</Text>
            </Pressable>
            <Pressable onPress={() => { setMode("off"); setWordInput(""); }} style={styles.button}>
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
          </View>
        </>
      )}

      {mode === "connect" && (
        <>
          <Text style={styles.hint}>Type the word you used on your other device.</Text>
          {field("your word")}
          {remote?.exists ? (
            localCards > 0 ? (
              <View style={styles.merge}>
                <Text style={styles.hint}>
                  This device has {localCards} cards of its own. Choose what
                  happens to them.
                </Text>
                <Pressable disabled={busy} onPress={() => finish("merge")} style={styles.button}>
                  <Text style={styles.buttonText}>Merge</Text>
                  <Text style={styles.sub}>keep the newer label per card</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={() => finish("replace")} style={styles.button}>
                  <Text style={styles.buttonText}>Replace</Text>
                  <Text style={styles.sub}>discard this device’s labels</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                disabled={busy}
                onPress={() => finish("replace")}
                style={[styles.button, styles.accent]}
              >
                <Text style={[styles.buttonText, styles.accentText]}>Load progress</Text>
              </Pressable>
            )
          ) : null}
          <Pressable onPress={() => { setMode("off"); setWordInput(""); }} style={styles.button}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
        </>
      )}

      {mode === "on" && (
        <>
          <Text style={styles.word}>{saved}</Text>
          <Text style={styles.meta}>
            {localCards} cards
            {synced ? ` · synced ${formatRelativeTime(synced)}` : " · not yet synced"}
          </Text>
          <View style={styles.row}>
            <Pressable disabled={busy} onPress={syncNow} style={[styles.button, styles.accent]}>
              <Text style={[styles.buttonText, styles.accentText]}>
                {busy ? "Syncing…" : "Sync now"}
              </Text>
            </Pressable>
            <Pressable
              onPress={async () => { await setWord(""); setSaved(""); setMode("off"); }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Stop syncing</Text>
            </Pressable>
          </View>
          <Text style={styles.warn}>
            This word is the only key. Anyone who guesses it can read and change
            your progress, so pick something no one would try.
          </Text>
        </>
      )}

      {busy && mode !== "on" ? <ActivityIndicator color={palette.accent} style={{ marginTop: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    hint: { color: p.textMuted, fontSize: 13, marginBottom: 10, lineHeight: 19 },
    input: {
      borderWidth: 1, borderColor: p.border, backgroundColor: p.codeBg,
      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
      color: p.textStrong, fontFamily: MONO_FONT, fontSize: 14,
    },
    hintLine: { marginTop: 8, fontSize: 12.5, fontFamily: MONO_FONT },
    norm: { marginTop: 5, fontSize: 12, fontFamily: MONO_FONT, color: p.textMuted },
    normStrong: { color: p.text },
    good: { color: "#6ee7a8" },
    bad: { color: "#f2777a" },
    mut: { color: p.textMuted },
    row: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 10 },
    button: {
      borderWidth: 1, borderColor: p.border, backgroundColor: p.surface,
      borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, marginTop: 8,
    },
    accent: { borderColor: p.accent },
    accentText: { color: p.accent },
    disabled: { opacity: 0.4 },
    buttonText: { color: p.textStrong, fontSize: 14, fontWeight: "600" },
    sub: { color: p.textMuted, fontSize: 12, marginTop: 2 },
    merge: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: p.border },
    word: {
      color: p.textStrong, fontFamily: MONO_FONT, fontSize: 15,
      backgroundColor: p.codeBg, borderWidth: 1, borderColor: p.border,
      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11,
    },
    meta: { color: p.textMuted, fontSize: 12, fontFamily: MONO_FONT, marginTop: 10 },
    warn: {
      marginTop: 14, borderLeftWidth: 2, borderLeftColor: "#fbbf24",
      paddingLeft: 12, color: p.textMuted, fontSize: 12.5, lineHeight: 18,
    },
    error: { marginTop: 10, color: p.errorFg, fontSize: 12.5 },
  });
}
