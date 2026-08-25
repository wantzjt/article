import type { GraphSnapshot } from "@/lib/store/graph";
import type { NightStopReason } from "./night-policy";

export type OceanTopicCount = {
  strong: number;
  provisional: number;
  stub: number;
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
  "urls",
  "claims",
  "topics",
  "whatMovedCount",
  "whatMoved",
  "spendTodayUsd",
  "lastRunAt",
] as const;

export type OceanSummary = {
  urls: number;
  claims: number;
  topics: OceanTopicCount;
  whatMoved: OceanMovedTopic[];
  spendTodayUsd: number;
  lastRunAt: string | null;
};

export function publicStatusPayload(input: {
  model: string;
  maxDailyModelSpendUsd: number;
  hardStop: string;
  summary: OceanSummary;
}) {
  return {
    ok: true as const,
    model: input.model,
    maxDailyModelSpendUsd: input.maxDailyModelSpendUsd,
    hardStop: input.hardStop,
    urls: input.summary.urls,
    claims: input.summary.claims,
    topics: input.summary.topics,
    whatMovedCount: input.summary.whatMoved.length,
    whatMoved: input.summary.whatMoved.slice(0, 12).map((row) => ({
      slug: row.slug,
      status: row.status,
      lastMaterialChangeAt: row.lastMaterialChangeAt,
    })),
    spendTodayUsd: Number(input.summary.spendTodayUsd.toFixed(6)),
    lastRunAt: input.summary.lastRunAt,
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
  const topics: OceanTopicCount = { strong: 0, provisional: 0, stub: 0 };
  for (const topic of graph.topics) {
    if (topic.status === "strong") topics.strong += 1;
    else if (topic.status === "provisional") topics.provisional += 1;
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
  return {
    urls: graph.sources.length,
    claims: graph.claims.filter((claim) => claim.status !== "rejected").length,
    topics,
    whatMoved,
    spendTodayUsd,
    lastRunAt: lastRunAt || null,
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
