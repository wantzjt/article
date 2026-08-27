import type { GraphSnapshot } from "@/lib/store/graph";
import type { NightStopReason } from "./night-policy";
import { yieldSnapshot } from "./yield";

export type OceanTopicCount = {
  strong: number;
  provisional: number;
  stub: number;
  candidate: number;
};

export type OceanMovedTopic = {
  slug: string;
  name: string;
  status: string;
  lastMaterialChangeAt: string;
  lastVerifiedAt: string | null;
};

export const STATUS_PUBLIC_KEYS = [
  "ok",
  "model",
  "maxDailyModelSpendUsd",
  "hardStop",
  "hardStopAt",
  "urls",
  "claims",
  "topics",
  "whatMovedCount",
  "whatMoved",
  "spendTodayUsd",
  "spendUsd",
  "spendCapUsd",
  "runner",
  "lastError",
  "lastRunAt",
  "yield",
] as const;

export type OceanSummary = {
  urls: number;
  claims: number;
  topics: OceanTopicCount;
  whatMoved: OceanMovedTopic[];
  spendTodayUsd: number;
  lastRunAt: string | null;
  lastError: string | null;
  yield: ReturnType<typeof yieldSnapshot>;
};

export const NIGHT_RUNNER_STALE_MS = 20 * 60_000;

export function safeLastError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/eyJ[A-Za-z0-9._-]{10,}/g, "[redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/sk-[A-Za-z0-9]{10,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 240) || null;
}

export function inferRunner(
  lastRunAt: string | null,
  now = new Date(),
  staleMs = NIGHT_RUNNER_STALE_MS,
): "night" | "idle" {
  if (!lastRunAt) return "idle";
  const at = Date.parse(lastRunAt);
  if (!Number.isFinite(at)) return "idle";
  return now.getTime() - at <= staleMs ? "night" : "idle";
}

export function publicStatusPayload(input: {
  model: string;
  maxDailyModelSpendUsd: number;
  spendCapUsd: number;
  hardStop: string;
  summary: OceanSummary;
  now?: Date;
}) {
  const spendUsd = Number(input.summary.spendTodayUsd.toFixed(6));
  return {
    ok: true as const,
    model: input.model,
    maxDailyModelSpendUsd: input.maxDailyModelSpendUsd,
    hardStop: input.hardStop,
    hardStopAt: input.hardStop,
    urls: input.summary.urls,
    claims: input.summary.claims,
    topics: input.summary.topics,
    whatMovedCount: input.summary.whatMoved.length,
    whatMoved: input.summary.whatMoved.slice(0, 12).map((row) => ({
      slug: row.slug,
      status: row.status,
      lastMaterialChangeAt: row.lastMaterialChangeAt,
    })),
    spendTodayUsd: spendUsd,
    spendUsd,
    spendCapUsd: input.spendCapUsd,
    runner: inferRunner(input.summary.lastRunAt, input.now),
    lastError: input.summary.lastError,
    lastRunAt: input.summary.lastRunAt,
    yield: input.summary.yield,
  };
}

export type NightTopicResult = {
  at: string;
  ok: boolean;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
  timeout?: boolean;
  spendCap?: boolean;
  status?: string;
  sources?: number;
  claims?: number;
  claimsDelta?: number;
  timeoutCycles?: number;
};

export type NightReport = {
  kind: "ocean-night";
  startedAt: string;
  stoppedAt: string;
  stopReason: NightStopReason | null;
  stopAt: string;
  primaryModel: string;
  spendCeilingUsd: number;
  spendTodayUsd: number;
  urls: number;
  claims: number;
  topics: OceanTopicCount;
  whatMoved: OceanMovedTopic[];
  attempted: string[];
  ok: string[];
  skipped: string[];
  failures: Array<{ slug: string; error?: string; timeout?: boolean }>;
  results: Record<string, NightTopicResult>;
};

export function summarizeOcean(graph: GraphSnapshot, now = new Date()): OceanSummary {
  const day = now.toISOString().slice(0, 10);
  const spendTodayUsd = graph.spend
    .filter((row) => row.day === day)
    .reduce((sum, row) => sum + row.costUsd, 0);
  const topics: OceanTopicCount = { strong: 0, provisional: 0, stub: 0, candidate: 0 };
  for (const topic of graph.topics) {
    if (topic.status === "strong") topics.strong += 1;
    else if (topic.status === "provisional") topics.provisional += 1;
    else if (topic.status === "candidate") topics.candidate += 1;
    else topics.stub += 1;
  }
  const whatMoved = graph.topics
    .filter((topic): topic is typeof topic & { lastMaterialChangeAt: string } => Boolean(topic.lastMaterialChangeAt))
    .sort((a, b) => b.lastMaterialChangeAt.localeCompare(a.lastMaterialChangeAt))
    .map((topic) => ({
      slug: topic.slug,
      name: topic.name,
      status: topic.status,
      lastMaterialChangeAt: topic.lastMaterialChangeAt,
      lastVerifiedAt: topic.lastVerifiedAt,
    }));
  const lastRunAt = graph.runs.reduce((latest, run) => (run.updatedAt > latest ? run.updatedAt : latest), "");
  const lastFailed = [...graph.runs]
    .filter((run) => run.status === "failed" && run.error)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .at(-1);
  return {
    urls: graph.sources.length,
    claims: graph.claims.filter((claim) => claim.status !== "rejected").length,
    topics,
    whatMoved,
    spendTodayUsd,
    lastRunAt: lastRunAt || null,
    lastError: safeLastError(lastFailed?.error),
    yield: yieldSnapshot(graph),
  };
}

export function formatNightReportMarkdown(report: NightReport): string {
  const moved = report.whatMoved
    .slice(0, 8)
    .map((row) => `- ${row.name} (${row.slug}) ${row.status}`)
    .join("\n");
  const failures = report.failures.length
    ? report.failures.map((row) => `- ${row.slug}: ${row.error ?? "failed"}`).join("\n")
    : "- none";
  const click = [
    "Explore https://article-gamma-rose.vercel.app/",
    "GLM-5.3 Play /topic/glm-5-3",
    "Anthropic /topic/anthropic",
    "OpenAI /topic/openai",
    "Claude 4 /topic/claude-4",
    "GET /api/status",
  ].join(" · ");
  return `# Ocean night report

Stopped: **${report.stopReason ?? "running"}** at ${report.stoppedAt}
Model: \`${report.primaryModel}\`
Spend today: **$${report.spendTodayUsd.toFixed(4)}** / night ceiling $${report.spendCeilingUsd.toFixed(2)}

| Graph | Count |
|---|---|
| URLs | ${report.urls} |
| Claims | ${report.claims} |
| Strong | ${report.topics.strong} |
| Provisional | ${report.topics.provisional} |
| Stub | ${report.topics.stub} |
| What Moved | ${report.whatMoved.length} |

## What Moved
${moved || "- none"}

## Attempted
ok: ${report.ok.join(", ") || "none"}
skipped: ${report.skipped.join(", ") || "none"}

## Failures
${failures}

## What to click
${click}
`;
}
