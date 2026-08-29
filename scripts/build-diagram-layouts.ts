/**
 * Precompute every diagram's layout into mobile/lib/diagrams/layouts.json.
 *
 * The router is a search: up to ~1.5 s per diagram on a laptop, several times
 * that in a phone WebView. Computing at build time means the app only draws.
 * Each entry carries a hash of the spec's geometry-relevant fields; the
 * renderer recomputes at runtime if the hash does not match (a spec edited
 * without rebuilding), so a stale file degrades to slow, never to wrong.
 *
 * Run: bunx tsx scripts/build-diagram-layouts.ts   (build-web.sh runs it)
 */
declare const process: { argv: string[]; exit(code: number): never };
import { writeFileSync } from "node:fs";
import { DIAGRAMS, allFigures } from "../mobile/lib/diagrams";
import { layoutDiagram, specHash, serializeLayout } from "../mobile/lib/diagrams/layout";

const out: Record<string, unknown> = {};
const t0 = Date.now();
for (const [id, d] of [...Object.entries(DIAGRAMS), ...Object.entries(allFigures())]) {
  const L = layoutDiagram(d);
  out[id] = { hash: specHash(d), layout: serializeLayout(L) };
}
writeFileSync("mobile/lib/diagrams/layouts.json", JSON.stringify(out));
console.log(`${Object.keys(out).length} layouts in ${((Date.now() - t0) / 1000).toFixed(1)}s -> mobile/lib/diagrams/layouts.json`);
