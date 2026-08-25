/**
 * Server-only configuration.
 * Brand strings live in brand.ts. Secrets never get NEXT_PUBLIC_ prefixes.
 */

export const FREE_COMPILE_MODEL = "zai/glm-5.2";
export const METERED_COMPILE_MODEL = "zai/glm-5.3";
/** Blackbox/eve GLM-5.2 promo. After this instant, 5.2 is not assumed free. */
export const GLM_52_FREE_UNTIL = process.env.GLM_52_FREE_UNTIL ?? "2026-08-27T23:59:00-05:00";

export function isGlm52FreeWindow(now = new Date()): boolean {
  const until = Date.parse(GLM_52_FREE_UNTIL);
  return Number.isFinite(until) && now.getTime() <= until;
}

/**
 * Compile model. Default is zai/glm-5.2 during the Blackbox/eve free window,
 * then zai/glm-5.3 under the $8 cap. Never silently swaps 5.2 → 5.3.
 */
export function resolvePrimaryModel(
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
): string {
  const explicit = env.PRIMARY_MODEL?.trim();
  if (explicit) return explicit;
  return isGlm52FreeWindow(now) ? FREE_COMPILE_MODEL : METERED_COMPILE_MODEL;
}

export const PRIMARY_MODEL = resolvePrimaryModel();

/** Optional explicit fallback model. Empty means fail closed — no 5.3 retry. */
export const COMPILE_MODEL_FALLBACK = (process.env.COMPILE_MODEL_FALLBACK ?? "").trim();

export function isFreeGlm52Compile(model = PRIMARY_MODEL, now = new Date()): boolean {
  return model === FREE_COMPILE_MODEL && isGlm52FreeWindow(now);
}

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
