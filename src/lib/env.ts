/**
 * Server-only configuration.
 * Brand strings live in brand.ts. Secrets never get NEXT_PUBLIC_ prefixes.
 */

export const PRIMARY_MODEL = process.env.PRIMARY_MODEL ?? "zai/glm-5.3";

/** Model token spend only. Exa via AI Gateway is a separate promo path and is not capped here. */
export const MAX_DAILY_MODEL_SPEND_USD = Number(
  process.env.MAX_DAILY_MODEL_SPEND_USD ?? "8",
);

/** Exa Search is invoked only as `gateway.tools.exaSearch()` (Eve/AI Gateway promo through 2026-08-31). */
export const EXA_PROMO_UNTIL = process.env.EXA_PROMO_UNTIL ?? "2026-08-31";
export const EXA_SEARCH_TYPE = (process.env.EXA_SEARCH_TYPE ?? "auto") as
  | "auto"
  | "fast"
  | "instant";
export const EXA_NUM_RESULTS = Number(process.env.EXA_NUM_RESULTS ?? "25");
export const EXA_CONCURRENCY = Number(process.env.EXA_CONCURRENCY ?? "8");
export const OCEAN_HARD_STOP = process.env.OCEAN_HARD_STOP ?? "2026-08-30T23:59:00-05:00";

export const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
export const TTS_MODEL = process.env.TTS_MODEL ?? "fish-audio/s2.1-pro";

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function isExaPromoActive(now = new Date()): boolean {
  return now.toISOString().slice(0, 10) <= EXA_PROMO_UNTIL;
}
