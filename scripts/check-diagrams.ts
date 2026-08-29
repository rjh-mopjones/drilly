/**
 * Readability gate for the architecture diagram specs.
 *
 * The previous gate measured collisions and passed 56 of 56 while the diagrams
 * were unreadable. This one measures what a reader sees, using the SAME
 * layoutDiagram() the renderer draws with, so the numbers here are the picture:
 *
 *  - zoom          fitView scale on the design canvas; below 0.8 the text is
 *                  too small to read at a glance             (error)
 *  - boxes         visible boxes after collapsing; more than 12 is a wiring
 *                  diagram, not an overview                  (error)
 *  - hot           hot-path edges; more than 8 and nothing is emphasised (error)
 *  - crossings     two lines crossing; a long way round always beats it (error)
 *  - box hits      a line running under or along a box it does not touch (error)
 *  - label length  over 28 chars collides even in a wide gutter (error)
 *  - process       a stage outside any serviceGroup is a false deployment claim (error)
 *  - unrouted      an edge the router could not place at all (error)
 *  - text items    boxes×2 + labels shown; over 40 is busy      (warning)
 *  - legacy        spec still on pixel x/y rather than col/row  (warning)
 *
 * Run: bunx tsx scripts/check-diagrams.ts [--summary] [id ...]
 * Exit 1 on any error.
 */
declare const process: { argv: string[]; exit(code: number): never };

import { readFileSync } from "node:fs";
import { DIAGRAMS, figureDiagram } from "../mobile/lib/diagrams";
import {
  beatLights,
  beatText,
  breaksHandled,
  breaksText,
  cruxHandled,
  cruxText,
  figureExplain,
  figureValue,
  isFrame,
  type Diagram,
  type Figure,
} from "../mobile/lib/diagrams/types";
import { GLOSSARY } from "../mobile/lib/diagrams/glossary";
import {
  layoutDiagram,
  parentOf,
  tierOf,
  MAX_BOXES,
  MAX_HOT,
  MAX_LABEL,
  MAX_NODE_LABEL,
  MAX_NODE_SUB,
  MIN_ZOOM,
  specHash,
} from "../mobile/lib/diagrams/layout";

/** Precomputed layouts ship in the bundle; a stale one means the app recomputes at runtime (slow), never wrong. */
let precomputed: Record<string, { hash: string }> = {};
try {
  precomputed = JSON.parse(readFileSync("mobile/lib/diagrams/layouts.json", "utf8"));
} catch {
  precomputed = {};
}

type Report = { errors: string[]; warnings: string[]; line: string };

/**
 * Text lint. The panel text exists to make the solution understood; these are
 * the ways it stopped doing that:
 *  - a reference to something the reader cannot see ("see #8", "Q13", "the prose")
 *  - interview coaching or narration of the drawing instead of the system
 *  - a `numbers` entry that is not a number, a `decider` that settles nothing
 *  - a box with no `detail` (an empty panel) or a real box with no `choice`
 *  - a beat that lights nothing, or names an id that does not exist
 *  - a term not in the glossary
 */
const CROSS_REF = [/(^|[^\w])#\d+\b/, /\bQ\d+\b/, /\bquestion \d+/i, /\bthe prose\b/i, /\bthe write-up\b/i, /\bthis book\b/i, /\bpseudocode\b/i, /\bother diagrams\b/i, /\bin this (set|app|collection)\b/i];
const COACHING = [/\binterview/i, /\bcandidates?\s+(should|waste|spend|often|tend|who|forget|rush)\b/i, /\b(strong|weak|good|typical|most) candidates?\b/i, /\bsay (it|this|that|so) out loud/i, /\bout loud\b/i, /\bdrawn (as|here|dashed|bold)\b/i, /\bin the diagram\b/i, /\bthis diagram\b/i, /\bthe picture\b/i, /\bworth (saying|stating)\b/i, /\btime budget\b/i];
const KNOWN = new Set(["HTTP", "HTTPS", "URL", "URLS", "API", "APIS", "SQL", "JSON", "CPU", "CPUS", "RAM", "GPU", "GPUS", "SSD", "HDD", "ID", "IDS", "OS", "UI", "TCP", "UDP", "IP", "IPS", "IO", "I/O", "GET", "POST", "PUT", "DELETE", "PATCH", "OK", "AND", "OR", "NOT", "NX", "EX", "LT", "RF", "TB", "GB", "MB", "KB", "PB", "EB", "GBPS", "MBPS", "TBPS", "US", "UK", "EU", "AWS", "GCP", "OSS", "AZS", "CDNS", "PSPS", "PII", "MVP", "SDK", "SDKS", "CLI", "IDE", "RPC", "RPCS", "REST", "CRUD", "UUID", "UUIDS", "ASCII", "UTF", "CSV", "PDF", "HTML", "CSS", "XML", "YAML", "DOM", "SVG", "PNG", "JPEG", "JPG", "WEBP", "AVIF", "HEIC", "MP4", "MPEG", "TS", "TTLS", "SLOS", "SLAS", "QPS", "RPS", "TPS", "FPS", "MACS", "GPS", "IOS", "WS", "TPU", "TPUS", "LB", "LBS", "VM", "VMS", "MS", "NS", "ISBNS", "ASN", "ASNS", "OSM", "MVT", "RFC", "KIP", "ETL", "OLAP", "OLTP", "ACID", "BASE", "CAP", "TL", "DR", "GC", "JVM", "GO", "LMAX", "NASDAQ", "SFTP", "SMTP", "IMAP", "POP3", "DKIM", "DMARC", "SPF", "ACH", "PAN", "CVV", "GDPR", "CCPA", "NTP", "PTP", "CIDR", "TLS", "SSL", "SNI", "OIDC", "SSO", "MFA", "JWT", "JWKS", "RSA", "EC", "HKDF", "KDF", "SHA", "HMAC", "AES", "KMS", "HSM", "IAM", "RBAC", "ACL", "ACLS", "CI", "CD", "DAG", "DAGS", "SHAS", "XA", "TCC", "PSP", "PCI", "DSS", "LRU", "LFU", "FIFO", "LIFO", "CRDT", "CRDTS", "OT", "TP1", "TP2", "MTU", "IOPS", "NVME", "RDMA", "NUMA", "SIMD", "FPGA", "FPGAS", "NIC", "NICS", "PDU", "DEM", "ETA", "ETAS", "KOM", "PR", "PRS", "ADR", "ISRC", "ISBN", "GPL", "MIT"]);
const UNIT = /^(\d|[KMGTPE]?B|MS|US|NS|GB|TB|PB|KB|MB|GBPS|MBPS|KBPS|GHZ|MHZ|X\d*|\d+[KMGT]?B?)$/;
const GLOSS_UPPER = new Set(Object.keys(GLOSSARY).map((k) => k.toUpperCase()));

/** Every glossary term, longest first, for counting how much jargon one paragraph leans on. */
const GLOSS_RE = new RegExp(
  `(?<![\\w-])(${Object.keys(GLOSSARY)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?![\\w-])`,
  "gi",
);
/** Same rule as the renderer's lookup: words match case-insensitively, acronyms only as written. */
function glossaryHas(raw: string): boolean {
  if (GLOSSARY[raw] !== undefined) return true;
  const lower = raw.toLowerCase();
  return raw !== lower ? false : GLOSSARY[lower] !== undefined;
}
const MAX_SENTENCE = 30;
const HARD_SENTENCE = 45;
const MAX_BEAT_TERMS = 3;
const MIN_HANDLED_WORDS = 12;

function sentences(s: string): string[] {
  return s.split(/(?<=[.!?])\s+(?=[A-Z0-9"'~(])/).filter((x) => x.trim().length);
}
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** A figure: a digit, or a number word standing where a digit would ("one fetch per host"). */
function hasDigit(s: string): boolean {
  return /\d/.test(s) || /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|dozen|half|single|once|twice|hundreds?|thousands?|millions?|billions?)\b/i.test(s);
}

function textLint(d: Diagram): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set(d.nodes.map((n) => n.id));
  const edgeIds = new Set(d.edges.map((e) => e.id));
  const texts: [string, string][] = [];
  const o = d.overview;
  texts.push(["overview.shape", o.shape], ["overview.crux", cruxText(o.crux)]);
  if (cruxHandled(o.crux)) texts.push(["overview.crux.handled", cruxHandled(o.crux) as string]);
  else warnings.push("overview.crux does not say how the design handles it (a bare string)");
  o.beats.forEach((b, i) => texts.push([`beat ${i + 1}`, beatText(b)]));
  const figures = (where: string, xs: Figure[] | undefined, fail: (m: string) => void) =>
    (xs ?? []).forEach((f, i) => {
      texts.push([`${where}[${i}]`, figureValue(f)]);
      if (!hasDigit(figureValue(f))) fail(`${where}[${i}] is not a number: "${figureValue(f)}"`);
      const ex = figureExplain(f);
      if (ex) texts.push([`${where}[${i}].explain`, ex]);
      else warnings.push(`${where}[${i}] has no explanation to tap: "${figureValue(f)}"`);
    });
  figures("overview.numbers", o.numbers, (m) => errors.push(m));
  const lightsOk = (where: string, lights: string[]) => {
    if (!lights.length) errors.push(`${where} lights nothing`);
    for (const id of lights) if (!nodeIds.has(id) && !edgeIds.has(id)) errors.push(`${where} lights unknown id "${id}"`);
  };
  if (!o.forces || o.forces.length < 3) errors.push(`overview.forces: ${o.forces?.length ?? 0} rows; a design has 3-5 constraints that forced it`);
  else if (o.forces.length > 5) warnings.push(`overview.forces has ${o.forces.length} rows; keep the 3-5 that matter`);
  (o.forces ?? []).forEach((f, i) => {
    texts.push([`force ${i + 1} constraint`, f.constraint], [`force ${i + 1} decision`, f.decision]);
    if (!hasDigit(f.constraint)) errors.push(`force ${i + 1} constraint carries no figure: "${f.constraint}"`);
    lightsOk(`force ${i + 1}`, f.lights);
  });
  if (!o.naive) errors.push("overview.naive missing: the obvious design and the number at which it breaks");
  else {
    texts.push(["overview.naive", o.naive.text]);
    if (!hasDigit(o.naive.text)) errors.push("overview.naive has no figure: say the number at which it breaks");
    lightsOk("overview.naive", o.naive.lights);
  }
  for (const n of d.nodes) {
    texts.push([`node "${n.label}" label`, n.label]);
    if (n.sub) texts.push([`node "${n.label}" sub`, n.sub]);
    const det = n.detail;
    if (!det) {
      errors.push(`node "${n.label}" has no detail: clicking it opens nothing`);
      continue;
    }
    texts.push([`node "${n.label}" what`, det.what], [`node "${n.label}" why`, det.why]);
    if (sentences(det.what).length > 2) warnings.push(`node "${n.label}" what is ${sentences(det.what).length} sentences; one plain sentence says what it is`);
    if (det.breaks) {
      texts.push([`node "${n.label}" breaks`, breaksText(det.breaks)]);
      const h = breaksHandled(det.breaks);
      if (h == null) warnings.push(`node "${n.label}" breaks does not say how the design handles it`);
      else {
        texts.push([`node "${n.label}" breaks.handled`, h]);
        if (wordCount(h) < MIN_HANDLED_WORDS) warnings.push(`node "${n.label}" breaks.handled is too thin: "${h}"`);
      }
    }
    figures(`node "${n.label}" numbers`, det.numbers, (m) => errors.push(m));
    if (det.choice) {
      for (const k of ["pick", "instead", "decider", "flips"] as const) texts.push([`node "${n.label}" choice.${k}`, det.choice[k]]);
      if (!hasDigit(det.choice.decider)) warnings.push(`node "${n.label}" choice.decider has no number or measurable property: "${det.choice.decider.slice(0, 60)}"`);
    } else if (!["client", "external", "process", "zone"].includes(n.kind)) {
      warnings.push(`node "${n.label}" (${n.kind}) has no choice: nothing says why it is built this way`);
    }
  }
  for (const e of d.edges) {
    if (!e.tier) errors.push(`edge ${e.id} has no tier (animated/dashed are legacy)`);
    if (e.label) texts.push([`edge ${e.id} label`, e.label]);
    const det = e.detail;
    if (!det) continue;
    texts.push([`edge ${e.id} what`, det.what], [`edge ${e.id} why`, det.why]);
    if (det.breaks) {
      texts.push([`edge ${e.id} breaks`, breaksText(det.breaks)]);
      const h = breaksHandled(det.breaks);
      if (h == null) warnings.push(`edge ${e.id} breaks does not say how the design handles it`);
      else {
        texts.push([`edge ${e.id} breaks.handled`, h]);
        if (wordCount(h) < MIN_HANDLED_WORDS) warnings.push(`edge ${e.id} breaks.handled is too thin: "${h}"`);
      }
    }
    figures(`edge ${e.id} numbers`, det.numbers, (m) => errors.push(m));
    if (det.choice) for (const k of ["pick", "instead", "decider", "flips"] as const) texts.push([`edge ${e.id} choice.${k}`, det.choice[k]]);
  }
  o.beats.forEach((b, i) => {
    const lights = beatLights(b);
    if (!lights.length) warnings.push(`beat ${i + 1} lights nothing`);
    for (const id of lights) if (!nodeIds.has(id) && !edgeIds.has(id)) errors.push(`beat ${i + 1} lights unknown id "${id}"`);
    const terms = new Set([...beatText(b).matchAll(GLOSS_RE)].filter((m) => glossaryHas(m[0])).map((m) => m[0].toLowerCase()));
    if (terms.size > MAX_BEAT_TERMS) warnings.push(`beat ${i + 1} leans on ${terms.size} glossary terms (${[...terms].join(", ")}); define the core ones in the sentence`);
  });
  // The hot path is numbered on the canvas: every hot edge has a step, steps are 1..n, nothing else has one.
  const hotEdges = d.edges.filter((e) => e.tier === "hot" || (!e.tier && e.animated));
  for (const e of d.edges) if (e.step != null && !hotEdges.includes(e)) errors.push(`edge ${e.id} has a step but is not hot`);
  const missing = hotEdges.filter((e) => e.step == null);
  if (missing.length) errors.push(`hot edges without a step: ${missing.map((e) => e.id).join(", ")}`);
  else {
    const steps = hotEdges.map((e) => e.step as number).sort((a, b) => a - b);
    if (steps.some((s, i) => s !== i + 1)) errors.push(`hot-edge steps are ${steps.join(",")}; they must run 1..${steps.length}`);
  }
  for (const [where, text] of texts) {
    if (/\b(label|sub)$/.test(where)) continue;
    for (const s of sentences(text)) {
      const w = wordCount(s);
      if (w > HARD_SENTENCE) errors.push(`${where}: a ${w}-word sentence; split it: "${s.slice(0, 50)}…"`);
      else if (w > MAX_SENTENCE) warnings.push(`${where}: a ${w}-word sentence: "${s.slice(0, 50)}…"`);
    }
  }
  const unknown = new Set<string>();
  for (const [where, text] of texts) {
    for (const re of CROSS_REF) if (re.test(text)) errors.push(`${where}: reference to something the reader cannot see: "${text.match(re)?.[0]?.trim()}"`);
    for (const re of COACHING) if (re.test(text)) errors.push(`${where}: explains the interview or the drawing, not the system: "${text.match(re)?.[0]}"`);
    for (const m of text.matchAll(/(?<![\w/-])([A-Z][A-Z0-9+.\-/]{1,}[A-Z0-9])(?![\w-])/g)) {
      const tok = m[1].replace(/[.,;:]$/, "");
      if (tok.length < 2 || UNIT.test(tok) || KNOWN.has(tok) || GLOSS_UPPER.has(tok)) continue;
      unknown.add(tok);
    }
  }
  if (unknown.size) warnings.push(`terms not in the glossary: ${[...unknown].sort().join(", ")}`);
  return { errors, warnings };
}

function check(authored: Diagram): Report {
  const errors: string[] = [];
  const warnings: string[] = [];

  const seen = new Set<string>();
  for (const n of authored.nodes) {
    if (seen.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
    seen.add(n.id);
  }
  for (const e of authored.edges) {
    if (!seen.has(e.from)) errors.push(`edge ${e.id}: no node "${e.from}"`);
    if (!seen.has(e.to)) errors.push(`edge ${e.id}: no node "${e.to}"`);
    if (e.label && e.label.length > MAX_LABEL)
      errors.push(`edge ${e.id} label ${e.label.length} chars (max ${MAX_LABEL}): "${e.label}"`);
    if (!e.detail) warnings.push(`edge ${e.id} has no detail; a click on it shows nothing`);
  }
  for (const n of authored.nodes) {
    if (n.kind === "process") {
      const p = parentOf(n, authored);
      const home = p && authored.nodes.find((f) => f.id === p && f.kind === "serviceGroup");
      if (!home) errors.push(`process "${n.label}" is not inside any serviceGroup`);
    }
    if (!isFrame(n.kind) && !n.detail) warnings.push(`node "${n.label}" has no detail`);
    if (!isFrame(n.kind) || n.kind === "serviceGroup") {
      if (n.label.length > MAX_NODE_LABEL)
        warnings.push(`"${n.label}" is ${n.label.length} chars; over ${MAX_NODE_LABEL} it is cut off with an ellipsis`);
      if (n.sub && n.sub.length > MAX_NODE_SUB)
        warnings.push(`sub of "${n.label}" is ${n.sub.length} chars; over ${MAX_NODE_SUB} it is cut off: "${n.sub}"`);
    }
  }
  if (errors.some((m) => m.startsWith("edge") && m.includes("no node"))) {
    return { errors, warnings, line: "" };
  }

  const lint = textLint(authored);
  errors.push(...lint.errors);
  warnings.push(...lint.warnings);
  const L = layoutDiagram(authored);
  const boxes = L.diagram.nodes.filter((n) => !isFrame(n.kind) || L.collapsed.has(n.id));
  const hot = L.diagram.edges.filter((e) => tierOf(e) === "hot");
  const routed = Object.keys(L.routes).length;
  const textItems = boxes.length * 2 + Object.keys(L.labels).length;

  if (L.onGrid) {
    const cells = new Map<string, string>();
    for (const n of boxes) {
      const key = `${n.col},${n.row}`;
      const other = cells.get(key);
      if (other) errors.push(`"${n.label}" and "${other}" share cell (${key})`);
      cells.set(key, n.label);
    }
  } else {
    warnings.push("legacy pixel layout: give every box a col/row (scripts/snap-diagrams-to-grid.ts)");
  }
  if (L.zoom < MIN_ZOOM)
    errors.push(`zoom ${L.zoom.toFixed(2)} < ${MIN_ZOOM}: ${Math.round(L.bounds.w)}×${Math.round(L.bounds.h)} units is too big to read`);
  if (boxes.length > MAX_BOXES) errors.push(`${boxes.length} visible boxes (max ${MAX_BOXES}): collapse a group or fold attributes into panels`);
  if (hot.length > MAX_HOT) errors.push(`${hot.length} hot edges (max ${MAX_HOT})`);
  if (L.crossings > 0) {
    const name = (id: string) => {
      const e = L.diagram.edges.find((x) => x.id === id);
      const lbl = (nid: string) => L.diagram.nodes.find((n) => n.id === nid)?.label ?? nid;
      return e ? `${id} (${lbl(e.from)} → ${lbl(e.to)})` : id;
    };
    errors.push(
      `${L.crossings} crossing(s): ${L.crossingPairs.map(([a, b]) => `${name(a)} × ${name(b)}`).join("; ")} — move cells, set fromSide/toSide, or use a frame-sourced edge`,
    );
  }
  if (L.boxHits > 0) errors.push(`${L.boxHits} arrow(s) run under or along a box`);
  if (routed < L.diagram.edges.length) errors.push(`${L.diagram.edges.length - routed} edge(s) could not be routed`);
  if (textItems > 40) warnings.push(`${textItems} text items on screen`);
  if (precomputed[authored.id]?.hash !== specHash(authored))
    warnings.push("precomputed layout is stale: run `bunx tsx scripts/build-diagram-layouts.ts` (build-web.sh does)");

  const line =
    `zoom ${L.zoom.toFixed(2).padStart(4)}  boxes ${String(boxes.length).padStart(2)}  edges ${String(L.diagram.edges.length).padStart(2)}` +
    `  hot ${hot.length}  cross ${String(L.crossings).padStart(2)}  hits ${L.boxHits}  ${L.onGrid ? "grid" : "px  "}`;
  return { errors, warnings, line };
}

const args = process.argv.slice(2);
const summary = args.includes("--summary");
const want = args.filter((a) => !a.startsWith("--"));
const ids = want.length ? want : Object.keys(DIAGRAMS);
let failed = 0;
let warned = 0;

/**
 * A figure is a small diagram: same router, same rules about crossings and
 * boxes under arrows, but judged on a phone-width canvas because that is
 * where it is read, and its boxes may carry no detail.
 */
const FIGURE_CANVAS_W = 340;
const FIGURE_CANVAS_H = 520;
function checkFigure(fig: Diagram): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const n of fig.nodes) {
    if (seen.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
    seen.add(n.id);
    if (n.label.length > MAX_NODE_LABEL) warnings.push(`"${n.label}" is ${n.label.length} chars; it will be cut off`);
    if (n.sub && n.sub.length > MAX_NODE_SUB) warnings.push(`sub of "${n.label}" is ${n.sub.length} chars; it will be cut off`);
  }
  for (const e of fig.edges) {
    if (!seen.has(e.from)) errors.push(`edge ${e.id}: no node "${e.from}"`);
    if (!seen.has(e.to)) errors.push(`edge ${e.id}: no node "${e.to}"`);
    if (e.label && e.label.length > MAX_LABEL) errors.push(`edge ${e.id} label ${e.label.length} chars (max ${MAX_LABEL})`);
    if (!e.tier) errors.push(`edge ${e.id} has no tier`);
  }
  const texts: string[] = [fig.title, ...fig.nodes.flatMap((n) => [n.label, n.sub ?? "", n.detail?.what ?? "", n.detail?.why ?? ""]), ...fig.edges.flatMap((e) => [e.label ?? "", e.detail?.what ?? "", e.detail?.why ?? ""])];
  for (const s of texts) {
    for (const re of CROSS_REF) if (re.test(s)) errors.push(`reference to something the reader cannot see: "${s.match(re)?.[0]}"`);
    for (const re of COACHING) if (re.test(s)) errors.push(`explains the interview or the drawing: "${s.match(re)?.[0]}"`);
  }
  if (errors.some((m) => m.includes("no node"))) return { errors, warnings, line: "" };
  const L = layoutDiagram(fig);
  const boxes = L.diagram.nodes.filter((n) => !isFrame(n.kind) || L.collapsed.has(n.id));
  const cols = new Set(boxes.map((n) => n.col)).size;
  const zoom = Math.min(FIGURE_CANVAS_W / L.bounds.w, FIGURE_CANVAS_H / L.bounds.h);
  if (boxes.length > 8) errors.push(`${boxes.length} boxes (max 8 in a figure)`);
  if (cols > 2) warnings.push(`${cols} columns; a figure reads on a phone at 2`);
  if (zoom < 0.4) errors.push(`phone zoom ${zoom.toFixed(2)} < 0.40: ${Math.round(L.bounds.w)}×${Math.round(L.bounds.h)} units is too wide for a phone; stack it`);
  else if (zoom < 0.55) warnings.push(`phone zoom ${zoom.toFixed(2)}: readable only after a pinch`);
  if (L.crossings > 0) errors.push(`${L.crossings} crossing(s)`);
  if (L.boxHits > 0) errors.push(`${L.boxHits} arrow(s) run under or along a box`);
  if (Object.keys(L.routes).length < fig.edges.length) errors.push(`${fig.edges.length - Object.keys(L.routes).length} edge(s) could not be routed`);
  if (precomputed[fig.id]?.hash !== specHash(fig)) warnings.push("precomputed layout is stale");
  const line = `phone zoom ${zoom.toFixed(2)}  boxes ${String(boxes.length).padStart(2)}  edges ${String(fig.edges.length).padStart(2)}  cols ${cols}  cross ${L.crossings}  hits ${L.boxHits}`;
  return { errors, warnings, line };
}

for (const id of ids) {
  const d = DIAGRAMS[id];
  if (!d) {
    console.error(`✗ ${id}: no such diagram`);
    failed++;
    continue;
  }
  const { errors, warnings, line } = check(d);
  const tag = errors.length ? "✗" : warnings.length ? "~" : "✓";
  if (errors.length) failed++;
  warned += warnings.length;
  console.log(`${tag} ${id.padEnd(22)} ${line}`);
  if (!summary) {
    for (const m of errors) console.log(`      ${m}`);
    for (const m of warnings) console.log(`      (warn) ${m}`);
  }
  for (const [key, fig] of Object.entries(d.figures ?? {})) {
    const r = checkFigure(figureDiagram(d, key) as Diagram);
    const ftag = r.errors.length ? "✗" : r.warnings.length ? "~" : "✓";
    if (r.errors.length) failed++;
    warned += r.warnings.length;
    console.log(`  ${ftag} figure ${key.padEnd(15)} ${r.line}`);
    if (summary) continue;
    for (const m of r.errors) console.log(`        ${m}`);
    for (const m of r.warnings) console.log(`        (warn) ${m}`);
  }
}

console.log(`\n${ids.length} diagram(s): ${ids.length - failed} clean, ${failed} failing, ${warned} warning(s)`);
process.exit(failed ? 1 : 0);
