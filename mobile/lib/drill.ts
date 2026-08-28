import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Pattern, SourceConfig } from "./parser";

/**
 * Drill — flashcards over the question-shaped primers.
 *
 * A deck is a source, a card is one question inside it. The topic the question
 * came from is deliberately NOT part of the card front: seeing "Caching" above
 * the question hands you the answer, so it is revealed with the answer instead.
 *
 * There is no spaced repetition here. A card carries one label, and labels are
 * filterable and resettable. That was a deliberate product choice over intervals.
 */

export type Label = "hard" | "medium" | "easy";
export type Filter = Label | "all" | "new";

/** One graded card. `at` is a timestamp so two devices can converge later. */
export interface Record_ {
  label: Label;
  at: number;
}

export type DeckRecords = Record<string, Record_>;

/** A single drillable question, resolved from a parsed source. */
export interface Card {
  /** Stable across content edits that insert items; breaks on retitle. */
  key: string;
  /** The question, with its `Qn.` prefix stripped. */
  question: string;
  /** The answer body, as markdown. */
  answer: string;
  /** The `## Topic` this question sits under. Withheld until reveal. */
  topic: string;
  /** The original `Qn.` label, or "" when the source does not number them. */
  number: string;
  /** For the "open in reader" link. */
  itemId: number;
}

export interface DeckStats {
  total: number;
  hard: number;
  medium: number;
  easy: number;
  unseen: number;
  /** 0..1, higher means better known. Drives weakest-first ordering. */
  mastery: number;
}

const DRILL_KEY = (sourceId: string) => `drill:${sourceId}`;

/** Sections that are prose, not questions, and never become cards. */
const NOT_A_QUESTION = new Set(["Summary"]);

/** A heading is a question if it asks one or is numbered `Qn.`. */
function isQuestion(name: string): boolean {
  const n = name.trim();
  if (NOT_A_QUESTION.has(n)) return false;
  return n.endsWith("?") || /^Q\d/.test(n);
}

/**
 * Whether a source can be drilled at all.
 *
 * Measured rather than listed: the katas, NeetCode and the System Design / SQL /
 * LeetCode question banks score 0-2% here because their sections are `Problem` /
 * `Core` / `Recognition` rather than questions, so they drop out on their own and
 * no allowlist has to be maintained by hand.
 */
export function isDrillable(items: Pattern[]): boolean {
  const sections = items.flatMap((i) => i.sections);
  if (sections.length < 20) return false;
  const q = sections.filter((s) => isQuestion(s.name)).length;
  return q / sections.length >= 0.6;
}

/** Strip the `Q34.` prefix; the number is shown with the answer instead. */
function splitNumber(name: string): { number: string; question: string } {
  const m = name.trim().match(/^(Q\d+[a-z]?)\.\s*(.*)$/);
  return m ? { number: m[1], question: m[2] } : { number: "", question: name.trim() };
}

/** Every drillable card in a source, in document order. */
export function cardsFor(items: Pattern[]): Card[] {
  const out: Card[] = [];
  for (const item of items) {
    for (const s of item.sections) {
      if (!isQuestion(s.name)) continue;
      const { number, question } = splitNumber(s.name);
      out.push({
        key: `${item.slug}#${s.name}`,
        question,
        answer: s.content,
        topic: item.title,
        number,
        itemId: item.id,
      });
    }
  }
  return out;
}

export function statsFor(cards: Card[], recs: DeckRecords): DeckStats {
  let hard = 0,
    medium = 0,
    easy = 0;
  for (const c of cards) {
    const r = recs[c.key];
    if (!r) continue;
    if (r.label === "hard") hard++;
    else if (r.label === "medium") medium++;
    else easy++;
  }
  const total = cards.length;
  const unseen = total - hard - medium - easy;
  // Unseen counts against you: a deck you have never opened is not "known".
  const mastery = total === 0 ? 0 : (easy + medium * 0.5) / total;
  return { total, hard, medium, easy, unseen, mastery };
}

export function filterCards(
  cards: Card[],
  recs: DeckRecords,
  filter: Filter,
): Card[] {
  if (filter === "all") return cards;
  if (filter === "new") return cards.filter((c) => !recs[c.key]);
  return cards.filter((c) => recs[c.key]?.label === filter);
}

/**
 * One blob per source rather than a key per card.
 *
 * `getProgressCount()` in storage.ts already scans the whole AsyncStorage
 * keyspace, and the home screen calls it once per SourceCard on focus. Adding
 * per-card keys under a scanned prefix would make the home screen quadratic.
 */
export async function loadDeck(sourceId: string): Promise<DeckRecords> {
  try {
    const raw = await AsyncStorage.getItem(DRILL_KEY(sourceId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: DeckRecords = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const r = v as Partial<Record_>;
      if (r && (r.label === "hard" || r.label === "medium" || r.label === "easy")) {
        out[k] = { label: r.label, at: typeof r.at === "number" ? r.at : 0 };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveDeck(
  sourceId: string,
  recs: DeckRecords,
): Promise<void> {
  try {
    await AsyncStorage.setItem(DRILL_KEY(sourceId), JSON.stringify(recs));
  } catch {
    // Storage can fail (private mode, quota). Losing a label is not worth
    // interrupting a drill session over.
  }
}

export async function resetDeck(sourceId: string): Promise<void> {
  await AsyncStorage.removeItem(DRILL_KEY(sourceId));
}

/** Fisher-Yates. A drill in document order would just be re-reading. */
export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
