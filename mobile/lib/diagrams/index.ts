/**
 * Diagram registry. One module per diagram under lib/diagrams/, so adding a
 * question touches a new file plus this one line, and parallel authoring never
 * collides. Types live in ./types.
 */
import { type Diagram, type Figure, beatLights, beatText, breaksHandled, breaksText, cruxHandled, cruxText, figureExplain, figureValue, isFrame } from "./types";
import { parentOf, tierOf } from "./layout";
import { WEB_CRAWLER } from "./web-crawler";
import { FLEET_UPDATE } from "./fleet-update";
import { ONLINE_AUCTION } from "./online-auction";
import { CICD } from "./cicd";
import { TRENDING_TOPICS } from "./trending-topics";
import { AUTH_SERVICE } from "./auth-service";
import { CDN } from "./cdn";
import { RAG_SYSTEM } from "./rag-system";
import { TICKETMASTER } from "./ticketmaster";
import { ECOMMERCE } from "./ecommerce";
import { WEB_SEARCH } from "./web-search";
import { LLM_SERVING } from "./llm-serving";
import { GOODREADS } from "./goodreads";
import { STRAVA } from "./strava";
import { MARKET_DATA_INGEST } from "./market-data-ingest";
import { MATCHING_ENGINE } from "./matching-engine";
import { PRICE_ALERTS } from "./price-alerts";
import { SPOTIFY } from "./spotify";
import { GITHUB } from "./github";
import { TINDER } from "./tinder";
import { COLLABORATIVE_EDITOR } from "./collaborative-editor";
import { JOB_SCHEDULER } from "./job-scheduler";
import { DISTRIBUTED_LOCK } from "./distributed-lock";
import { DISTRIBUTED_CACHE } from "./distributed-cache";
import { ZOOM } from "./zoom";
import { SLACK } from "./slack";
import { NETFLIX } from "./netflix";
import { BOOKING_PLATFORM } from "./booking-platform";
import { RIDE_HAILING } from "./ride-hailing";
import { TIKTOK } from "./tiktok";
import { INSTAGRAM } from "./instagram";
import { TWITTER } from "./twitter";
import { STOCK_EXCHANGE } from "./stock-exchange";
import { DIGITAL_WALLET } from "./digital-wallet";
import { PAYMENT_SYSTEM } from "./payment-system";
import { GAMING_LEADERBOARD } from "./gaming-leaderboard";
import { OBJECT_STORAGE } from "./object-storage";
import { EMAIL_SERVICE } from "./email-service";
import { HOTEL_RESERVATION } from "./hotel-reservation";
import { AD_CLICK_AGGREGATION } from "./ad-click-aggregation";
import { METRICS_MONITORING } from "./metrics-monitoring";
import { MESSAGE_QUEUE } from "./message-queue";
import { GOOGLE_MAPS } from "./google-maps";
import { NEARBY_FRIENDS } from "./nearby-friends";
import { PROXIMITY_SERVICE } from "./proximity-service";
import { GOOGLE_DRIVE } from "./google-drive";
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
  "fleet-update": FLEET_UPDATE,
  "online-auction": ONLINE_AUCTION,
  "cicd": CICD,
  "trending-topics": TRENDING_TOPICS,
  "auth-service": AUTH_SERVICE,
  "cdn": CDN,
  "rag-system": RAG_SYSTEM,
  "ticketmaster": TICKETMASTER,
  "ecommerce": ECOMMERCE,
  "web-search": WEB_SEARCH,
  "llm-serving": LLM_SERVING,
  "goodreads": GOODREADS,
  "strava": STRAVA,
  "market-data-ingest": MARKET_DATA_INGEST,
  "matching-engine": MATCHING_ENGINE,
  "price-alerts": PRICE_ALERTS,
  "spotify": SPOTIFY,
  "github": GITHUB,
  "tinder": TINDER,
  "collaborative-editor": COLLABORATIVE_EDITOR,
  "job-scheduler": JOB_SCHEDULER,
  "distributed-lock": DISTRIBUTED_LOCK,
  "distributed-cache": DISTRIBUTED_CACHE,
  "zoom": ZOOM,
  "slack": SLACK,
  "netflix": NETFLIX,
  "booking-platform": BOOKING_PLATFORM,
  "ride-hailing": RIDE_HAILING,
  "tiktok": TIKTOK,
  "instagram": INSTAGRAM,
  "twitter": TWITTER,
  "stock-exchange": STOCK_EXCHANGE,
  "digital-wallet": DIGITAL_WALLET,
  "payment-system": PAYMENT_SYSTEM,
  "gaming-leaderboard": GAMING_LEADERBOARD,
  "object-storage": OBJECT_STORAGE,
  "email-service": EMAIL_SERVICE,
  "hotel-reservation": HOTEL_RESERVATION,
  "ad-click-aggregation": AD_CLICK_AGGREGATION,
  "metrics-monitoring": METRICS_MONITORING,
  "message-queue": MESSAGE_QUEUE,
  "google-maps": GOOGLE_MAPS,
  "nearby-friends": NEARBY_FRIENDS,
  "proximity-service": PROXIMITY_SERVICE,
  "google-drive": GOOGLE_DRIVE,
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

/** A figure as a Diagram of its own, so the layout engine and renderer need no special case. */
export function figureDiagram(d: Diagram, key: string): Diagram | undefined {
  const f = d.figures?.[key];
  if (!f) return undefined;
  return {
    id: `${d.id}#${key}`,
    title: f.title,
    question: d.question,
    overview: { shape: "", beats: [], crux: "" },
    sourceId: d.sourceId,
    itemId: d.itemId,
    nodes: f.nodes,
    edges: f.edges,
  };
}

/** Every figure of every diagram, keyed `<diagram>#<figure>`, for the layout build and the gate. */
export function allFigures(): Record<string, Diagram> {
  const out: Record<string, Diagram> = {};
  for (const d of Object.values(DIAGRAMS)) for (const key of Object.keys(d.figures ?? {})) out[`${d.id}#${key}`] = figureDiagram(d, key) as Diagram;
  return out;
}

/** The diagram belonging to a reader item, if one exists. */
/**
 * Where a tap on an item goes. A question with a diagram opens on the diagram
 * (the picture is the answer; the write-up sits behind its Deep dive button);
 * everything else opens the reader.
 */
export function itemRoute(sourceId: string, itemId: number): string {
  const d = getDiagramForItem(sourceId, itemId);
  return d ? `/diagram/${d.id}` : `/reader/${sourceId}/${itemId}`;
}

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
  const out: string[] = [`## Interactive diagram: ${d.title}`, "", `*${d.question}*`, ""];
  const o = d.overview;
  const byId = (id: string) => d.nodes.find((n) => n.id === id)?.label ?? id;
  const edgeName = (id: string) => {
    const e = d.edges.find((x) => x.id === id);
    return e ? `${byId(e.from)} → ${byId(e.to)}` : id;
  };
  const figures = (xs: Figure[]) => xs.map((f) => `- ${figureValue(f)}${figureExplain(f) ? ` — ${figureExplain(f)}` : ""}`);
  out.push("### Overview", "", `**The shape of it.** ${o.shape}`, "");
  if (o.naive) out.push(`**The obvious design, and where it breaks.** ${o.naive.text}`, "");
  out.push("**How it works.**", "");
  o.beats.forEach((b, i) => {
    const lights = beatLights(b).map((id) => (d.nodes.some((n) => n.id === id) ? byId(id) : edgeName(id)));
    out.push(`${i + 1}. ${beatText(b)}${lights.length ? ` _(${lights.join(", ")})_` : ""}`);
  });
  out.push("");
  if (o.forces?.length) {
    out.push("**What forces what.**", "", "| Constraint | Decision |", "|---|---|");
    for (const f of o.forces) out.push(`| ${f.constraint} | ${f.decision} |`);
    out.push("");
  }
  if (o.numbers?.length) out.push("**Numbers.**", "", ...figures(o.numbers), "");
  out.push(`**The hard part.** ${cruxText(o.crux)}`, "");
  if (cruxHandled(o.crux)) out.push(`**How the design handles it.** ${cruxHandled(o.crux)}`, "");

  out.push("### Components", "");
  // Frames first, then their members, so the note keeps the containment the picture shows.
  const parent = (n: (typeof d.nodes)[number]) => parentOf(n, d);
  const order: typeof d.nodes = [];
  const place = (n: (typeof d.nodes)[number]) => {
    if (order.includes(n)) return;
    order.push(n);
    for (const c of d.nodes) if (parent(c) === n.id) place(c);
  };
  for (const n of d.nodes) if (!parent(n)) place(n);
  for (const n of order) {
    if (!n.detail) continue;
    const home = parent(n) ? d.nodes.find((x) => x.id === parent(n))?.label : undefined;
    const role = isFrame(n.kind)
      ? n.kind === "serviceGroup"
        ? ` — one service; stages: ${d.nodes.filter((c) => parent(c) === n.id).map((c) => c.label).join(", ")}`
        : ` — boundary around ${d.nodes.filter((c) => parent(c) === n.id).map((c) => c.label).join(", ")}`
      : home
        ? ` — ${n.kind === "process" ? "stage of" : "inside"} ${home}`
        : "";
    out.push(`#### ${n.label}${n.sub ? ` (${n.sub})` : ""}${role}`, "");
    out.push(`- **What it is.** ${n.detail.what}`);
    out.push(`- **Why it exists.** ${n.detail.why}`);
    if (n.detail.numbers?.length) out.push("- **Numbers.**", ...figures(n.detail.numbers).map((l) => `  ${l}`));
    if (n.detail.breaks) {
      out.push(`- **What breaks.** ${breaksText(n.detail.breaks)}`);
      if (breaksHandled(n.detail.breaks)) out.push(`- **How the design handles it.** ${breaksHandled(n.detail.breaks)}`);
    }
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
    const tier = tierOf(e);
    const step = e.step != null ? `${e.step}. ` : "";
    out.push(`#### ${step}${hop}${e.label ? ` (${e.label})` : ""}${tier === "hot" ? " — hot path" : tier === "control" ? " — control" : ""}`, "");
    out.push(`- **What it is.** ${e.detail.what}`);
    out.push(`- **Why it exists.** ${e.detail.why}`);
    if (e.detail.numbers?.length) out.push("- **Numbers.**", ...figures(e.detail.numbers).map((l) => `  ${l}`));
    if (e.detail.breaks) {
      out.push(`- **What breaks.** ${breaksText(e.detail.breaks)}`);
      if (breaksHandled(e.detail.breaks)) out.push(`- **How the design handles it.** ${breaksHandled(e.detail.breaks)}`);
    }
    const c = e.detail.choice;
    if (c) {
      out.push(`- **Why this way.**`);
      out.push(`  - Choice: ${c.pick}`);
      out.push(`  - Instead of: ${c.instead}`);
      out.push(`  - Decider: ${c.decider}`);
      out.push(`  - Alternative wins when: ${c.flips}`);
    }
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}
