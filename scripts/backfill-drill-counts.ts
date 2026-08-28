/**
 * Backfill `drillCards` (number of question-shaped sections) into every local
 * source in both manifests, so the Drill deck list can render instantly.
 *
 * Without this the deck list would have to load and parse all ~50 primers just
 * to show a card count, which is hundreds of megabytes of markdown on a screen
 * that is meant to open immediately.
 *
 * Sources that are not question-shaped get no `drillCards` field at all, which
 * is how Drill filters them out: the katas, NeetCode and the System Design /
 * SQL / LeetCode question banks are built from `Problem` / `Core` / `Recognition`
 * sections rather than questions, so they drop out on their own.
 *
 * Run after adding/editing a primer:  bun run scripts/backfill-drill-counts.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parseContent } from "../packages/parser/src/parser";

const ROOT = join(import.meta.dir, "..");
const WEB_PUBLIC = join(ROOT, "web", "public");
const MANIFESTS = [
  join(WEB_PUBLIC, "manifest.json"),
  join(ROOT, "mobile", "assets", "content", "manifest.json"),
];

// Keep these two rules identical to isQuestion()/isDrillable() in
// mobile/lib/drill.ts — if they drift, the deck list and the drill screen
// disagree about what a card is.
const NOT_A_QUESTION = new Set(["Summary"]);
const isQuestion = (n: string) =>
  !NOT_A_QUESTION.has(n.trim()) &&
  (n.trim().endsWith("?") || /^Q\d/.test(n.trim()));

const manifest = JSON.parse(readFileSync(MANIFESTS[0], "utf8"));
const counts: Record<string, number> = {};
let skipped = 0;

for (const s of manifest.sources) {
  if (s.externalUrl || !s.file || !String(s.file).endsWith(".md")) continue;
  const md = readFileSync(
    join(WEB_PUBLIC, String(s.file).replace(/^\//, "")),
    "utf8",
  );
  const items = parseContent(md, {
    itemHeadingLevel: s.itemHeadingLevel ?? 3,
    sectionHeadingLevel: s.sectionHeadingLevel ?? 4,
    autoNumberItems: s.autoNumberItems ?? false,
  } as never);
  const sections = items.flatMap((i: { sections: { name: string }[] }) => i.sections);
  const q = sections.filter((x) => isQuestion(x.name)).length;
  const ratio = sections.length ? q / sections.length : 0;
  if (sections.length < 20 || ratio < 0.6) {
    skipped++;
    console.log(`  skip ${s.id} (${Math.round(ratio * 100)}% question-shaped)`);
    continue;
  }
  counts[s.id] = q;
  console.log(`  ${s.id}: ${q} cards`);
}

for (const path of MANIFESTS) {
  const m = JSON.parse(readFileSync(path, "utf8"));
  for (const s of m.sources) {
    if (s.id in counts) s.drillCards = counts[s.id];
    else delete s.drillCards;
  }
  writeFileSync(path, JSON.stringify(m, null, 2) + "\n");
}

console.log(
  `\ndrillable: ${Object.keys(counts).length} sources, ` +
    `${Object.values(counts).reduce((a, b) => a + b, 0)} cards; ${skipped} skipped`,
);
