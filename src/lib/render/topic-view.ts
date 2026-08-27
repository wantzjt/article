import { brand } from "@/lib/brand";
import type { TopicEntityMeta } from "@/lib/compiler/types";
import { topicKind } from "@/lib/compiler/taxonomy";
import type { GraphSnapshot, TopicGraph } from "@/lib/store/graph";
import { topicIdFromSource } from "@/lib/store/graph";
import { robotsForStatus } from "@/lib/compiler/publication";
import type { SourceRecord, TopicRecord } from "@/lib/compiler/types";

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatTime(iso: string | null): string {
  if (!iso) return "never";
  const date = formatDate(iso);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(new Date(iso));
  return `${date}, ${time} UTC`;
}

export function oneLine(text: string, max = 160): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

export function splitSentences(text: string): string[] {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return [];
  return compact.split(/(?<=[.!?])\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean);
}

/** Topic dek on the page: at most two sentences, short enough for ~390px. */
export function displayDek(text: string, maxChars = 240): string {
  const sentences = splitSentences(text).slice(0, 2);
  if (sentences.length === 0) return "";
  let out = sentences[0];
  if (sentences[1] && `${out} ${sentences[1]}`.length <= maxChars) {
    out = `${out} ${sentences[1]}`;
  }
  return out.length <= maxChars ? out : oneLine(out, maxChars);
}

export function shortExcerpt(text: string, max = 160): string {
  const first = splitSentences(text)[0] ?? text;
  return oneLine(first, max);
}

/** Explore “what moved”: a material-change line, never the topic dek. */
export function changeLine(input: {
  briefHeadline?: string | null;
  changeSummary?: string | null;
}): string {
  const headline = input.briefHeadline?.replace(/\s+/g, " ").trim();
  if (headline) return oneLine(splitSentences(headline)[0] ?? headline, 140);
  const summary = input.changeSummary?.replace(/\s+/g, " ").trim();
  if (summary) return oneLine(splitSentences(summary)[0] ?? summary, 140);
  return "Material change recorded.";
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function lastRetrievedAt(sources: SourceRecord[]): string | null {
  let latest = "";
  for (const source of sources) {
    if (source.retrievedAt > latest) latest = source.retrievedAt;
  }
  return latest || null;
}

export function sourceCountsByTopicId(sources: SourceRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const source of sources) {
    const topicId = topicIdFromSource(source);
    if (!topicId) continue;
    counts.set(topicId, (counts.get(topicId) ?? 0) + 1);
  }
  return counts;
}

export type WarehouseCoverage = {
  urls: number;
  topics: number;
  strong: number;
  provisional: number;
  stub: number;
  people: number;
  lastRetrievedAt: string | null;
};

export function warehouseCoverage(graph: GraphSnapshot): WarehouseCoverage {
  let strong = 0;
  let provisional = 0;
  let stub = 0;
  let people = 0;
  for (const topic of graph.topics) {
    if (topic.status === "strong") strong += 1;
    else if (topic.status === "provisional") provisional += 1;
    else stub += 1;
    if (topicKind(topic) === "person") people += 1;
  }
  return {
    urls: graph.sources.length,
    topics: graph.topics.length,
    strong,
    provisional,
    stub,
    people,
    lastRetrievedAt: lastRetrievedAt(graph.sources),
  };
}

export type WarehouseInventoryRow = {
  slug: string;
  name: string;
  kind: string;
  status: TopicRecord["status"];
  sourceCount: number;
  banked: boolean;
};

export function warehouseInventory(graph: GraphSnapshot, limit = 36): WarehouseInventoryRow[] {
  const counts = sourceCountsByTopicId(graph.sources);
  const rows = graph.topics.map((topic) => {
    const sourceCount = counts.get(topic.id) ?? 0;
    return {
      slug: topic.slug,
      name: topic.name,
      kind: topicKind(topic),
      status: topic.status,
      sourceCount,
      banked: topic.status === "stub" && sourceCount > 0,
    };
  });
  const people = rows
    .filter((row) => row.kind === "person")
    .sort((a, b) => b.sourceCount - a.sourceCount || a.name.localeCompare(b.name));
  const seen = new Set(people.map((row) => row.slug));
  const stubs = rows
    .filter((row) => row.banked && !seen.has(row.slug))
    .sort((a, b) => b.sourceCount - a.sourceCount || a.name.localeCompare(b.name));
  return [...people, ...stubs].slice(0, limit);
}

export type PersonIdentity = {
  name: string | null;
  role: string | null;
  company: string | null;
  location: string | null;
};

function workEntry(row: unknown): { title: string | null; company: string | null; current: boolean } | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as {
    title?: unknown;
    company?: { name?: unknown } | null;
    dates?: { to?: unknown } | null;
  };
  const title = typeof rec.title === "string" && rec.title.trim() ? rec.title.trim() : null;
  const company =
    rec.company && typeof rec.company.name === "string" && rec.company.name.trim()
      ? rec.company.name.trim()
      : null;
  if (!title && !company) return null;
  const to = rec.dates && "to" in rec.dates ? rec.dates.to : undefined;
  const current = to == null || to === "";
  return { title, company, current };
}

/** Public role line from persisted Exa entity_meta. Empty fields stay empty — no invented bio. */
export function personIdentity(meta: TopicEntityMeta | null | undefined): PersonIdentity | null {
  if (!meta || meta.exa_type !== "person") return null;
  const entries = (meta.workHistory ?? []).map(workEntry).filter(Boolean) as Array<{
    title: string | null;
    company: string | null;
    current: boolean;
  }>;
  const current = entries.find((row) => row.current) ?? entries[0];
  const name = typeof meta.name === "string" && meta.name.trim() ? meta.name.trim() : null;
  const location = typeof meta.location === "string" && meta.location.trim() ? meta.location.trim() : null;
  if (!name && !current && !location) return null;
  return {
    name,
    role: current?.title ?? null,
    company: current?.company ?? null,
    location,
  };
}

export const WAREHOUSE_SOURCE_PAGE_LIMIT = 40;

export function warehouseSourceList(sources: SourceRecord[], limit = WAREHOUSE_SOURCE_PAGE_LIMIT): SourceRecord[] {
  return [...sources]
    .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, limit);
}

export function evidenceLabel(graph: TopicGraph, claimId: string): string {
  const claim = graph.claims.find((row) => row.id === claimId);
  if (!claim) return "0 independent · 0 primary";
  const domains = new Set(claim.evidence.map((row) => row.source.publisherDomain));
  const primary = claim.evidence.filter((row) => row.source.primaryStatus === "primary").length;
  return `${domains.size} independent · ${primary} primary`;
}

export function topicMarkdown(graph: TopicGraph): string {
  const lines = [
    `# ${graph.topic.name}`,
    "",
    graph.topic.description,
    "",
    `Status: ${graph.topic.status}`,
    `Last verified: ${graph.topic.lastVerifiedAt ?? "never"}`,
    "",
    "## Evidence",
    "",
  ];
  for (const claim of graph.claims.filter((row) => row.status !== "rejected")) {
    lines.push(`- (${claim.status}) ${claim.claimText}`);
    for (const item of claim.evidence) {
      lines.push(`  - ${item.supportType} ${item.source.canonicalUrl}`);
      lines.push(`    > ${item.evidenceExcerpt}`);
    }
    lines.push("");
  }
  if (graph.versions.length) {
    lines.push("## Timeline", "");
    for (const version of graph.versions) {
      lines.push(`- ${version.createdAt}: ${version.changeSummary}`);
    }
  }
  return lines.join("\n");
}

export function jsonLd(graph: TopicGraph, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: graph.topic.name,
    description: graph.topic.description,
    url: `${siteUrl}/topic/${graph.topic.slug}`,
    dateModified: graph.topic.lastVerifiedAt ?? graph.topic.updatedAt,
    creator: { "@type": "Organization", name: brand.productName },
  };
}

export { robotsForStatus };
