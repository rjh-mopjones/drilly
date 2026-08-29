/** Print a diagram's structure compactly: nodes with cells, edges with tiers. For planning a floorplan. */
declare const process: { argv: string[] };
import { DIAGRAMS } from "../mobile/lib/diagrams";
import { tierOf } from "../mobile/lib/diagrams/layout";
for (const id of process.argv.slice(2)) {
  const d = DIAGRAMS[id];
  if (!d) continue;
  console.log(`== ${id}: ${d.title}`);
  for (const n of d.nodes)
    console.log(`  ${n.kind.padEnd(12)} ${n.id.padEnd(18)} (${n.col ?? "-"},${n.row ?? "-"})${n.parent ? " in " + n.parent : ""}${n.expanded ? " expanded" : ""}  "${n.label}" / "${n.sub ?? ""}"`);
  for (const e of d.edges)
    console.log(`  ${e.id.padEnd(5)} ${tierOf(e).padEnd(7)} ${e.from} -> ${e.to}  "${e.label ?? ""}"${e.fromSide || e.toSide ? ` [${e.fromSide ?? ""}>${e.toSide ?? ""}]` : ""}`);
}
