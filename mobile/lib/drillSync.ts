import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadDeck, saveDeck, type DeckRecords, type Record_ } from "./drill";

/**
 * Sync Drill progress under a memorable word.
 *
 * The word is the only credential. It is normalised on every path so that
 * "Cache-Coherence" and " cache-coherence " are the same account rather than
 * two, which would otherwise be a silent way to lose your progress.
 */

const WORD_KEY = "drill:syncWord";
const SYNCED_KEY = "drill:lastSynced";
export const MIN_WORD = 8;

/** Lowercase and trim. Must stay in step with the API's WORD regex. */
export function normalise(w: string): string {
  return w.trim().toLowerCase();
}

export function wordError(w: string): string | null {
  const n = normalise(w);
  if (n.length === 0) return null;
  if (n.length < MIN_WORD) return `${MIN_WORD - n.length} more character${MIN_WORD - n.length === 1 ? "" : "s"}`;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(n)) return "Letters, numbers and hyphens only";
  return null;
}

export async function getWord(): Promise<string> {
  return (await AsyncStorage.getItem(WORD_KEY)) ?? "";
}
export async function setWord(w: string): Promise<void> {
  if (w) await AsyncStorage.setItem(WORD_KEY, normalise(w));
  else await AsyncStorage.removeItem(WORD_KEY);
}
export async function getLastSynced(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(SYNCED_KEY);
  return raw ? Number(raw) : null;
}

export interface Remote {
  exists: boolean;
  cards?: number;
  data?: Record<string, Record_>;
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

/** Does this word already hold progress? Doubles as the taken-check. */
export async function lookup(word: string): Promise<Remote> {
  const res = await call(`/api/drill-sync?word=${encodeURIComponent(normalise(word))}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Lookup failed");
  return res.json();
}

export async function push(
  word: string,
  all: Record<string, DeckRecords>,
): Promise<void> {
  // One flat map across every deck: `sourceId::cardKey`. Flat keeps the merge
  // a single pass and the payload small.
  const flat: Record<string, Record_> = {};
  for (const [sourceId, recs] of Object.entries(all)) {
    for (const [k, v] of Object.entries(recs)) flat[`${sourceId}::${k}`] = v;
  }
  const res = await call("/api/drill-sync", {
    method: "POST",
    body: JSON.stringify({ word: normalise(word), data: flat }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Sync failed");
  await AsyncStorage.setItem(SYNCED_KEY, String(Date.now()));
}

/** Split a flat remote blob back into per-source records. */
export function explode(flat: Record<string, Record_>): Record<string, DeckRecords> {
  const out: Record<string, DeckRecords> = {};
  for (const [k, v] of Object.entries(flat)) {
    const i = k.indexOf("::");
    if (i < 0) continue;
    const sourceId = k.slice(0, i);
    (out[sourceId] ??= {})[k.slice(i + 2)] = v;
  }
  return out;
}

/** Last write wins per card, so two devices converge instead of clobbering. */
export function mergeRecords(mine: DeckRecords, theirs: DeckRecords): DeckRecords {
  const out: DeckRecords = { ...theirs };
  for (const [k, v] of Object.entries(mine)) {
    const t = out[k];
    if (!t || v.at >= t.at) out[k] = v;
  }
  return out;
}

/**
 * Deck ids held locally, read from storage rather than the manifest so a deck
 * whose source has since been renamed or dropped still syncs instead of being
 * silently left behind. One getAllKeys on an explicit refresh is fine; the
 * per-card-key version this avoids is what would make it expensive.
 */
async function localDeckIds(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys
    .filter((k) => k.startsWith("drill:") && k !== WORD_KEY && k !== SYNCED_KEY)
    .map((k) => k.slice("drill:".length));
}

/**
 * Two-way sync: pull, merge per card, then write the merged result to BOTH
 * sides. This is what the refresh button runs.
 *
 * It is deliberately not a bare push. Push alone is last-write-wins per
 * *device*: grade on the laptop, then refresh on the phone, and the phone's
 * copy — which never saw those cards — would overwrite every one of them.
 * Merging first means the two converge, which is the whole point of the
 * timestamp already stored on each label.
 *
 * Returns null when no word is set. Drill is ephemeral by default and must not
 * touch the network in that state.
 */
export async function syncAll(): Promise<{ cards: number } | null> {
  const word = await getWord();
  if (!word) return null;

  const remote = await lookup(word);
  const theirs = explode((remote.data ?? {}) as Record<string, Record_>);

  const ids = new Set([...(await localDeckIds()), ...Object.keys(theirs)]);
  const merged: Record<string, DeckRecords> = {};
  let cards = 0;
  for (const id of ids) {
    const next = mergeRecords(await loadDeck(id), theirs[id] ?? {});
    const n = Object.keys(next).length;
    if (!n) continue;
    merged[id] = next;
    cards += n;
    await saveDeck(id, next);
  }
  await push(word, merged);
  return { cards };
}
