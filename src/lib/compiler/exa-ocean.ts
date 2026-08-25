import { randomUUID } from "node:crypto";
import type { SeedEntity, SourceRecord } from "./types";
import { classifySource } from "./primary";
import { contentHash } from "./hash";
import { canonicalizeUrl } from "./urls";
import type { DiscoveredSource } from "@/lib/gateway/exa";
import { contentTypeForPass, exaOceanPasses, topicKind, type ExaCategory } from "./taxonomy";

export type ExaOceanStopReason = "hard_stop" | "queue" | "signal" | "quota";

export type ExaOceanTopicResult = {
  slug: string;
  ok: boolean;
  pass: number;
  queriesRun: number;
  hits: number;
  sourcesAdded: number;
  sourcesUnchanged: number;
  durationMs: number;
  errors: string[];
  createdStub: boolean;
  gatewayCostUsd: number;
};

export function isExaHardStop(nowMs: number, hardStopMs: number): boolean {
  return nowMs >= hardStopMs;
}

export function exaOceanStopReason(input: {
  nowMs: number;
  hardStopMs: number;
  queueRemaining: number;
  signaled: boolean;
}): ExaOceanStopReason | null {
  if (input.signaled) return "signal";
  if (input.nowMs >= input.hardStopMs) return "hard_stop";
  if (input.queueRemaining <= 0) return "queue";
  return null;
}

export function buildExaOceanQueue(input: {
  slugs: string[];
  completed: Iterable<string>;
  sourceCounts?: Record<string, number>;
  thinPass: boolean;
}): string[] {
  const done = new Set(input.completed);
  const remaining = input.slugs.filter((slug) => !done.has(slug));
  if (!input.thinPass) return remaining;
  const counts = input.sourceCounts ?? {};
  return [...remaining].sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0) || a.localeCompare(b));
}

export function exaOceanQueries(entity: SeedEntity): string[] {
  return exaOceanPasses(entity).map((pass) => pass.query);
}

export function discoveredToSourceRecords(input: {
  hits: DiscoveredSource[];
  entity: SeedEntity;
  topicId: string;
  existingByUrl: Map<string, SourceRecord>;
}): { pending: SourceRecord[]; added: number; unchanged: number; urls: string[] } {
  const pending: SourceRecord[] = [];
  let added = 0;
  let unchanged = 0;
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const hit of input.hits) {
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeUrl(hit.canonicalUrl);
    } catch {
      continue;
    }
    if (seen.has(canonicalUrl)) continue;
    seen.add(canonicalUrl);
    urls.push(canonicalUrl);
    const excerpt = (hit.highlights.join(" ") || "").replace(/\u0000/g, "").slice(0, 2000);
    const hash = contentHash([canonicalUrl, hit.title, excerpt]);
    const prior = input.existingByUrl.get(canonicalUrl);
    if (prior && prior.contentHash === hash) {
      unchanged += 1;
      continue;
    }
    const classified = classifySource({
      domain: hit.publisherDomain,
      officialDomains: input.entity.officialDomains,
    });
    const exaCategory: ExaCategory = hit.exaCategory ?? "web";
    pending.push({
      id: prior?.id ?? randomUUID(),
      canonicalUrl,
      title: hit.title,
      publisher: hit.publisherDomain,
      publisherDomain: hit.publisherDomain,
      author: hit.author,
      publishedAt: hit.publishedAt,
      retrievedAt: new Date().toISOString(),
      sourceType: classified.sourceType,
      primaryStatus: classified.primaryStatus,
      contentHash: hash,
      evidenceExcerpt: excerpt,
      metadata: {
        query: hit.query,
        query_tag: hit.queryTag ?? "web",
        via: "ai-gateway:exaSearch",
        arm: "exa-ocean",
        topic_id: input.topicId,
        topicId: input.topicId,
        topicSlug: input.entity.slug,
        topic_kind: topicKind(input.entity),
        exa_category: exaCategory,
        content_type: contentTypeForPass(exaCategory, classified.sourceType),
        domain: hit.publisherDomain,
        raw_entity_meta: hit.publishedAt ? { published_at: hit.publishedAt } : null,
      },
    });
    added += 1;
  }
  return { pending, added, unchanged, urls };
}

export function formatExaOceanReportMarkdown(report: {
  sha: string;
  startedAt: string;
  stoppedAt: string;
  stopReason: ExaOceanStopReason | null;
  hardStopAt: string;
  urlsBefore: number;
  urlsAfter: number;
  claimsBefore: number;
  claimsAfter: number;
  stubsCreated: number;
  modelSpendUsd: number;
  gatewayVehicleCostUsd: number;
  rateLimits: number;
  errors: string[];
  topGainers: Array<{ slug: string; added: number; hits: number }>;
  stillThin: Array<{ slug: string; sources: number }>;
  attempted: number;
  ok: number;
}): string {
  const remainingMs = Date.parse(report.hardStopAt) - Date.parse(report.stoppedAt);
  const remainingH = Number.isFinite(remainingMs) ? Math.max(0, remainingMs / 3600000) : 0;
  return `# Exa ocean report

SHA: \`${report.sha}\`
Started: ${report.startedAt}
Stopped: **${report.stopReason ?? "running"}** at ${report.stoppedAt}
Hard stop: ${report.hardStopAt} (${remainingH.toFixed(1)}h remaining)

| Metric | Value |
|---|---|
| URLs before → after | ${report.urlsBefore} → **${report.urlsAfter}** (Δ ${report.urlsAfter - report.urlsBefore}) |
| Claims before → after | ${report.claimsBefore} → ${report.claimsAfter} |
| Stub topics created | ${report.stubsCreated} |
| Topics attempted / ok | ${report.attempted} / ${report.ok} |
| Graph model spend events | **$${report.modelSpendUsd.toFixed(2)}** |
| Gateway vehicle cost (provider-tool loop) | $${report.gatewayVehicleCostUsd.toFixed(4)} |
| Rate limits | ${report.rateLimits} |

## Top source gainers
${report.topGainers.map((row) => `- ${row.slug}: +${row.added} (hits ${row.hits})`).join("\n") || "- none yet"}

## Still thin (fewest sources)
${report.stillThin.map((row) => `- ${row.slug}: ${row.sources}`).join("\n") || "- none"}

## Errors
${report.errors.length ? report.errors.map((row) => `- ${row}`).join("\n") : "- none"}
`;
}
