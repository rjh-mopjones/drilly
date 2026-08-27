/**
 * Diagram registry. One module per diagram under lib/diagrams/, so adding a
 * question touches a new file plus this one line, and parallel authoring never
 * collides. Types live in ./types.
 */
import type { Diagram } from "./types";
import { WEB_CRAWLER } from "./web-crawler";
import { YOUTUBE } from "./youtube";
import { SEARCH_AUTOCOMPLETE } from "./search-autocomplete";
import { CHAT_SYSTEM } from "./chat-system";
import { NEWS_FEED } from "./news-feed";
import { NOTIFICATION_SYSTEM } from "./notification-system";
import { URL_SHORTENER } from "./url-shortener";
import { UNIQUE_ID_GENERATOR } from "./unique-id-generator";
import { DISTRIBUTED_KV_STORE } from "./distributed-kv-store";
import { CONSISTENT_HASHING } from "./consistent-hashing";
import { RATE_LIMITER } from "./rate-limiter";

export * from "./types";

export const DIAGRAMS: Record<string, Diagram> = {
  "web-crawler": WEB_CRAWLER,
  "youtube": YOUTUBE,
  "search-autocomplete": SEARCH_AUTOCOMPLETE,
  "chat-system": CHAT_SYSTEM,
  "news-feed": NEWS_FEED,
  "notification-system": NOTIFICATION_SYSTEM,
  "url-shortener": URL_SHORTENER,
  "unique-id-generator": UNIQUE_ID_GENERATOR,
  "distributed-kv-store": DISTRIBUTED_KV_STORE,
  "consistent-hashing": CONSISTENT_HASHING,
  "rate-limiter": RATE_LIMITER,
};

export function getDiagram(id: string): Diagram | undefined {
  return DIAGRAMS[id];
}

/** The diagram belonging to a reader item, if one exists. */
export function getDiagramForItem(sourceId: string, itemId: number): Diagram | undefined {
  return Object.values(DIAGRAMS).find(
    (d) => d.sourceId === sourceId && d.itemId === itemId,
  );
}

/**
 * Flatten a diagram to Markdown so the reader's copy-all action carries the
 * explanations, not just the link. Everything a component says on screen ends
 * up here, in reading order.
 */
export function diagramToMarkdown(d: Diagram): string {
  const out: string[] = [`## Interactive diagram: ${d.title}`, ""];
  const o = d.overview;
  out.push("### Overview", "", `**The shape of it.** ${o.shape}`, "");
  out.push("**How it works.**", "");
  o.beats.forEach((b, i) => out.push(`${i + 1}. ${b}`));
  out.push("");
  if (o.numbers?.length) out.push(`**Numbers.** ${o.numbers.join(" · ")}`, "");
  out.push(`**The hard part.** ${o.crux}`, "");

  const byId = (id: string) => d.nodes.find((n) => n.id === id)?.label ?? id;

  out.push("### Components", "");
  for (const n of d.nodes) {
    if (!n.detail) continue;
    out.push(`#### ${n.label}${n.sub ? ` (${n.sub})` : ""}`, "");
    out.push(`- **What it is.** ${n.detail.what}`);
    out.push(`- **Why it exists.** ${n.detail.why}`);
    if (n.detail.numbers?.length)
      out.push(`- **Numbers.** ${n.detail.numbers.join(" · ")}`);
    if (n.detail.breaks) out.push(`- **What breaks.** ${n.detail.breaks}`);
    const c = n.detail.choice;
    if (c) {
      out.push(`- **Why this technology.**`);
      out.push(`  - Choice: ${c.pick}`);
      out.push(`  - Instead of: ${c.instead}`);
      out.push(`  - Decider: ${c.decider}`);
      out.push(`  - Alternative wins when: ${c.flips}`);
    }
    out.push("");
  }

  out.push("### Connections", "");
  for (const e of d.edges) {
    if (!e.detail) continue;
    const hop = `${byId(e.from)} -> ${byId(e.to)}`;
    out.push(`#### ${hop}${e.label ? ` (${e.label})` : ""}`, "");
    out.push(`- **What it is.** ${e.detail.what}`);
    out.push(`- **Why it exists.** ${e.detail.why}`);
    if (e.detail.numbers?.length)
      out.push(`- **Numbers.** ${e.detail.numbers.join(" · ")}`);
    if (e.detail.breaks) out.push(`- **What breaks.** ${e.detail.breaks}`);
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}
