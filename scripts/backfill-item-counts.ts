/**
 * Backfill `itemCount` (number of top-level topics) into every local source
 * in both manifests, so the desktop sidebar can show a per-category count
 * without eagerly parsing every source at mount.
 *
 * Run after adding/editing a primer:  bun run scripts/backfill-item-counts.ts
 * External-only sources (externalUrl, no parseable markdown) are left alone.
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

// Count once from web/public (both manifests share the same files).
const manifest = JSON.parse(readFileSync(MANIFESTS[0], "utf8"));
const counts: Record<string, number> = {};
for (const s of manifest.sources) {
  if (s.externalUrl || !s.file || !String(s.file).endsWith(".md")) continue;
  const md = readFileSync(join(WEB_PUBLIC, String(s.file).replace(/^\//, "")), "utf8");
  const items = parseContent(md, {
    itemHeadingLevel: s.itemHeadingLevel ?? 3,
    sectionHeadingLevel: s.sectionHeadingLevel ?? 4,
    autoNumberItems: s.autoNumberItems ?? false,
  } as never);
  counts[s.id] = items.length;
  console.log(`  ${s.id}: ${items.length}`);
}

for (const path of MANIFESTS) {
  const m = JSON.parse(readFileSync(path, "utf8"));
  for (const s of m.sources) {
    if (s.id in counts) s.itemCount = counts[s.id];
    else delete s.itemCount;
  }
  writeFileSync(path, JSON.stringify(m, null, 2) + "\n");
  console.log(`✓ wrote ${path}`);
}
