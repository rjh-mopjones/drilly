/**
 * Draw a diagram's computed layout as a standalone SVG page, for eyeballing a
 * spec without building the app. Writes <out>/<id>.html for each id.
 *
 *   bunx tsx scripts/render-diagram.ts <outDir> <id> [id ...]
 *   node scripts/render-diagram-png.js <outDir> <id> [id ...]   # screenshots (needs playwright)
 */
declare const process: { argv: string[]; exit(code: number): never };
import { mkdirSync, writeFileSync } from "node:fs";
import { DIAGRAMS } from "../mobile/lib/diagrams";
import { isFrame } from "../mobile/lib/diagrams/types";
import { displayLabel, labelWidth, layoutDiagram, routePath, tierOf } from "../mobile/lib/diagrams/layout";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const [outDir, ...ids] = process.argv.slice(2);
if (!outDir || !ids.length) {
  console.error("usage: bunx tsx scripts/render-diagram.ts <outDir> <id> [id ...]");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const d = DIAGRAMS[id];
  if (!d) {
    console.error(`no such diagram: ${id}`);
    continue;
  }
  const L = layoutDiagram(d);
  const b = L.bounds;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x - 20} ${b.y - 20} ${b.w + 40} ${b.h + 40}" width="${b.w + 40}" height="${b.h + 40}" font-family="Helvetica,Arial" style="background:#fff">`;
  s += `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#334"/></marker></defs>`;
  for (const n of L.diagram.nodes) {
    const r = L.rects[n.id];
    if (!r) continue;
    const frame = isFrame(n.kind) && !L.collapsed.has(n.id);
    s += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="9" fill="${frame ? "#00000006" : "#eef2ff"}" stroke="${frame ? "#999" : "#3253c7"}" stroke-dasharray="${frame ? "4 4" : ""}"/>`;
    const tag = L.collapsed.has(n.id) ? `${L.pipelines[n.id].length} STAGES` : n.kind.toUpperCase();
    s += `<text x="${r.x + r.w - 8}" y="${r.y + 12}" font-size="8" text-anchor="end" fill="#3253c7">${tag}</text>`;
    s += `<text x="${r.x + 10}" y="${r.y + (frame ? 16 : 30)}" font-size="${frame ? 11 : 14}" font-weight="600">${esc(n.label)}</text>`;
    if (!frame && n.sub) s += `<text x="${r.x + 10}" y="${r.y + 47}" font-size="11" fill="#666">${esc(n.sub)}</text>`;
  }
  for (const e of L.diagram.edges) {
    const r = L.routes[e.id];
    if (!r) continue;
    const tier = tierOf(e);
    const hot = tier === "hot";
    s += `<path d="${routePath(r.points)}" fill="none" stroke="${hot ? "#3253c7" : "#667"}" stroke-width="${hot ? 2.4 : 1.2}" ${tier === "control" ? 'stroke-dasharray="5 4"' : ""} marker-end="url(#a)"/>`;
    const lp = L.labels[e.id];
    if (lp && e.label) {
      const w = labelWidth(displayLabel(e));
      s += `<rect x="${lp[0] - w / 2}" y="${lp[1] - 9}" width="${w}" height="18" rx="4" fill="#fff" stroke="#3253c7"/>`;
      if (e.step != null) {
        s += `<circle cx="${lp[0] - w / 2 + 11}" cy="${lp[1]}" r="7" fill="#3253c7"/><text x="${lp[0] - w / 2 + 11}" y="${lp[1] + 3}" font-size="9" font-weight="700" text-anchor="middle" fill="#fff">${e.step}</text>`;
      }
      s += `<text x="${lp[0] + (e.step != null ? 9 : 0)}" y="${lp[1] + 4}" font-size="11" text-anchor="middle" fill="#3253c7">${esc(e.label)}</text>`;
    }
    const mid = r.points[Math.floor(r.points.length / 2)];
    s += `<text x="${mid[0] + 3}" y="${mid[1] - 3}" font-size="9" fill="#c33">${e.id}</text>`;
  }
  s += `<text x="${b.x}" y="${b.y + b.h + 32}" font-size="12" fill="#c33">zoom ${L.zoom.toFixed(2)} · crossings ${L.crossings} · box hits ${L.boxHits}</text></svg>`;
  writeFileSync(`${outDir}/${id}.html`, `<!doctype html><body style="margin:0">${s}</body>`);
  console.log(`${id.padEnd(22)} zoom ${L.zoom.toFixed(2)} cross ${L.crossings} hits ${L.boxHits} -> ${outDir}/${id}.html`);
}
