/**
 * Assert what the app actually sees for the System Design Questions source.
 *
 * validate_sd.py checks the markdown text with regexes. This runs the real
 * `parseContent` with the real manifest config, so it catches anything the
 * parser does that a regex would miss (fence handling, section attribution,
 * items silently dropped for having no sections).
 *
 *   bun run scripts/nc-parse-check.ts
 *   bun run scripts/nc-parse-check.ts --write   # re-baseline after an intended change
 *
 * Exits 1 on any mismatch.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { parseContent } from "../packages/parser/src/parser";

const ROOT = join(import.meta.dir, "..");
const SOURCE_ID = "neetcode";
const SNAPSHOT = join(ROOT, "scripts", "nc-parse-snapshot.json");
const write = process.argv.includes("--write");

const manifest = JSON.parse(
  readFileSync(join(ROOT, "web", "public", "manifest.json"), "utf8"),
);
const cfg = manifest.sources.find((s: { id: string }) => s.id === SOURCE_ID);
if (!cfg) throw new Error(`no '${SOURCE_ID}' source in manifest`);

const md = readFileSync(
  join(ROOT, "web", "public", String(cfg.file).replace(/^\//, "")),
  "utf8",
);

const items = parseContent(md, {
  itemHeadingLevel: cfg.itemHeadingLevel ?? 3,
  sectionHeadingLevel: cfg.sectionHeadingLevel ?? 4,
  autoNumberItems: cfg.autoNumberItems ?? false,
  sectionOrder: cfg.sectionOrder ?? [],
} as never);

const actual = {
  itemCount: items.length,
  ids: items.map((i) => i.id),
  sections: Object.fromEntries(
    items.map((i) => [i.id, i.sections.map((s) => s.name)]),
  ) as Record<string, string[]>,
};

const problems: string[] = [];

// Invariants that hold regardless of migration progress.
if (cfg.itemCount !== actual.itemCount) {
  problems.push(
    `manifest itemCount ${cfg.itemCount} != parsed ${actual.itemCount} (run: bun run scripts/backfill-item-counts.ts)`,
  );
}
for (const item of items) {
  if (item.sections.length === 0) {
    problems.push(`item ${item.id} parsed with zero sections; it would be dropped`);
  }
  const names = item.sections.map((s) => s.name);
  const dupes = names.filter((n, idx) => names.indexOf(n) !== idx);
  if (dupes.length) {
    problems.push(`item ${item.id} has duplicate section names: ${[...new Set(dupes)].join(", ")}`);
  }
}
for (const name of cfg.defaultRevealedSections ?? []) {
  const missing = items.filter((i) => !i.sections.some((s) => s.name === name));
  if (missing.length) {
    problems.push(
      `defaultRevealedSections '${name}' missing from ${missing.length} item(s): ${missing
        .slice(0, 5)
        .map((i) => i.id)
        .join(", ")}`,
    );
  }
}

if (write || !existsSync(SNAPSHOT)) {
  writeFileSync(SNAPSHOT, JSON.stringify(actual, null, 1) + "\n");
  console.log(`wrote snapshot: ${actual.itemCount} items -> ${SNAPSHOT}`);
} else {
  const prev = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  if (JSON.stringify(prev.ids) !== JSON.stringify(actual.ids)) {
    problems.push(
      `item ids changed. Deep links (/reader/${SOURCE_ID}/<id>) and saved reveal state are keyed on these.\n` +
        `  was: ${prev.ids.join(",")}\n  now: ${actual.ids.join(",")}`,
    );
  }
  for (const [id, names] of Object.entries(actual.sections)) {
    const before = (prev.sections as Record<string, string[]>)[id];
    if (before && JSON.stringify(before) !== JSON.stringify(names)) {
      console.log(`  item ${id}: sections changed`);
      console.log(`    was: ${before.join(" | ")}`);
      console.log(`    now: ${names.join(" | ")}`);
    }
  }
}

if (problems.length) {
  console.error("\nparse-check FAILED:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `parse-check ok: ${actual.itemCount} items, ids ${actual.ids[0]}..${actual.ids[actual.ids.length - 1]}, ` +
    `${Object.values(actual.sections).reduce((a, s) => a + s.length, 0)} sections`,
);
