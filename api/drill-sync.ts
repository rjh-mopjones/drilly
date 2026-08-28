import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/**
 * Drill progress sync, keyed by a memorable word.
 *
 * The word is the only credential, by design: there is no account and no second
 * factor. That makes two things load-bearing here, because the endpoint is
 * public on a public site — the rate limit, and the fact that a word is only
 * ever a key into an opaque blob of flashcard labels.
 *
 * The Upstash Marketplace integration injects KV_* names rather than the
 * UPSTASH_REDIS_REST_* pair that Redis.fromEnv() looks for, so the client is
 * constructed explicitly. fromEnv() would throw at runtime here.
 */

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

/** Lazy: the module must import cleanly even when env vars are absent. */
let _redis: Redis | null = null;
function redis(): Redis | null {
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

let _limiter: Ratelimit | null = null;
function limiter(): Ratelimit | null {
  const r = redis();
  if (!r) return null;
  if (!_limiter) {
    _limiter = new Ratelimit({
      redis: r,
      // Generous for a human, hostile to someone enumerating words.
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "drill:rl",
    });
  }
  return _limiter;
}

const KEY = (word: string) => `drill:v1:${word}`;
/** Matches the client's normalise(): lowercase, trimmed, 8-64 chars. */
const WORD = /^[a-z0-9][a-z0-9-]{7,63}$/;
/** ~14k cards at ~50 bytes each, with headroom. Rejects abuse, not real use. */
const MAX_BYTES = 512 * 1024;

interface Req {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
  setHeader(k: string, v: string): void;
}

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");

  const r = redis();
  if (!r) {
    return res.status(503).json({ error: "Sync is not configured on this deployment." });
  }

  const ip =
    first(req.headers["x-forwarded-for"]).split(",")[0].trim() || "unknown";
  const rl = limiter();
  if (rl) {
    const { success } = await rl.limit(ip);
    if (!success) {
      return res.status(429).json({ error: "Too many requests. Wait a minute." });
    }
  }

  const word = first(
    req.method === "GET"
      ? req.query.word
      : ((req.body as { word?: string } | undefined)?.word ?? ""),
  )
    .trim()
    .toLowerCase();

  if (!WORD.test(word)) {
    return res.status(400).json({
      error: "Words are 8 to 64 characters, letters, numbers and hyphens.",
    });
  }

  if (req.method === "GET") {
    const data = await r.get<Record<string, { label: string; at: number }>>(KEY(word));
    if (!data) return res.status(200).json({ exists: false });
    return res.status(200).json({
      exists: true,
      cards: Object.keys(data).length,
      data,
    });
  }

  if (req.method === "POST") {
    const body = req.body as { data?: unknown } | undefined;
    const data = body?.data;
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Missing progress payload." });
    }
    const serialised = JSON.stringify(data);
    if (serialised.length > MAX_BYTES) {
      return res.status(413).json({ error: "Progress payload is too large." });
    }
    await r.set(KEY(word), data);
    return res.status(200).json({
      ok: true,
      cards: Object.keys(data as object).length,
    });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
