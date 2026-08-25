export const NIGHT_TZ = "America/Chicago";
export const NIGHT_STOP_HOUR = 6;
export const NIGHT_SPEND_CEILING_USD = 6.5;
export const NIGHT_MAX_TIMEOUT_CYCLES = 2;

/** Fixed night order, then remaining seeds by official-domain density. */
export const NIGHT_PRIORITY_SLUGS = [
  "anthropic",
  "openai",
  "claude-4",
  "google-deepmind",
  "xai",
  "meta-ai",
  "mistral-ai",
  "nvidia",
  "groq",
  "databricks",
] as const;

export type ChicagoWall = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type NightStopReason = "clock" | "spend" | "queue" | "hard_stop" | "signal";

export type NightSkipReason = "already_ok" | "strong" | "timeout_burn";

export function chicagoWall(now: Date): ChicagoWall {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NIGHT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function chicagoWallToUtcMs(wall: ChicagoWall): number {
  let utc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  for (let i = 0; i < 12; i += 1) {
    const got = chicagoWall(new Date(utc));
    const gotAsUtc = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
    const wantAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
    const delta = wantAsUtc - gotAsUtc;
    if (delta === 0) return utc;
    utc += delta;
  }
  return utc;
}

export function addChicagoCalendarDays(wall: ChicagoWall, days: number): ChicagoWall {
  const noon = chicagoWallToUtcMs({ ...wall, hour: 12, minute: 0, second: 0 }) + days * 86_400_000;
  const next = chicagoWall(new Date(noon));
  return { year: next.year, month: next.month, day: next.day, hour: wall.hour, minute: wall.minute, second: wall.second };
}

/** Next 06:00 America/Chicago strictly after `now` if already at/after 06:00. */
export function nextNightStopMs(now = new Date(), stopHour = NIGHT_STOP_HOUR): number {
  const wall = chicagoWall(now);
  const todayStop = chicagoWallToUtcMs({ ...wall, hour: stopHour, minute: 0, second: 0 });
  if (now.getTime() < todayStop) return todayStop;
  return chicagoWallToUtcMs(addChicagoCalendarDays({ ...wall, hour: stopHour, minute: 0, second: 0 }, 1));
}

export function nightStopReason(input: {
  nowMs: number;
  stopAtMs: number;
  spendUsd: number;
  spendCeilingUsd: number;
  queueRemaining: number;
  hardStopMs: number;
}): NightStopReason | null {
  if (input.nowMs >= input.hardStopMs) return "hard_stop";
  if (input.nowMs >= input.stopAtMs) return "clock";
  if (input.spendUsd >= input.spendCeilingUsd) return "spend";
  if (input.queueRemaining <= 0) return "queue";
  return null;
}

export function buildNightQueue(input: {
  seedSlugs: string[];
  prioritySlugs?: readonly string[];
  officialSourceCount?: Record<string, number>;
  demoSlug?: string;
}): string[] {
  const seeds = new Set(input.seedSlugs);
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const slug of input.prioritySlugs ?? NIGHT_PRIORITY_SLUGS) {
    if (!seeds.has(slug) || seen.has(slug)) continue;
    queue.push(slug);
    seen.add(slug);
  }
  const density = input.officialSourceCount ?? {};
  const rest = input.seedSlugs
    .filter((slug) => !seen.has(slug))
    .sort((a, b) => (density[b] ?? 0) - (density[a] ?? 0) || a.localeCompare(b));
  const demo = input.demoSlug ?? "glm-5-3";
  const tail = rest.filter((slug) => slug === demo);
  const mid = rest.filter((slug) => slug !== demo);
  return [...queue, ...mid, ...tail];
}

export function nightSkipReason(input: {
  status: string;
  priorOk: boolean;
  timeoutCycles: number;
  maxTimeoutCycles?: number;
  lastClaimsDelta?: number | null;
}): NightSkipReason | null {
  if (input.priorOk) return "already_ok";
  if (input.status === "strong") return "strong";
  const max = input.maxTimeoutCycles ?? NIGHT_MAX_TIMEOUT_CYCLES;
  if (input.timeoutCycles >= max && (input.lastClaimsDelta ?? 0) <= 0) return "timeout_burn";
  return null;
}

export function nightSpendCeilingUsd(dailyCapUsd: number, nightCeilingUsd = NIGHT_SPEND_CEILING_USD): number {
  if (!Number.isFinite(nightCeilingUsd) || nightCeilingUsd <= 0) return Math.min(NIGHT_SPEND_CEILING_USD, dailyCapUsd);
  return Math.min(nightCeilingUsd, dailyCapUsd);
}
