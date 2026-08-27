import { brand } from "@/lib/brand";
import { compileBlocked } from "@/lib/compiler/compile-priority";
import type { TopicEntityMeta } from "@/lib/compiler/types";
import { topicKind } from "@/lib/compiler/taxonomy";
import type { GraphSnapshot, TopicGraph } from "@/lib/store/graph";
import { topicIdFromSource } from "@/lib/store/graph";
import { robotsForStatus } from "@/lib/compiler/publication";
import { DEMO_LAUNCH_SLUGS } from "@/lib/seed/entities";
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

export function namesAlign(left: string, right: string): boolean {
  const n = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const a = n(left);
  const b = n(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
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

export const PULSE_LIMIT = 8;
export const RADAR_LIMIT = 12;
export const LATEST_EVIDENCE_LIMIT = 5;
export const WAREHOUSE_SOURCE_PAGE_LIMIT = 40;

const DEMO_PULSE_ORDER = new Map<string, number>(DEMO_LAUNCH_SLUGS.map((slug, index) => [slug, index]));

export function isDemoLaunchSlug(slug: string): boolean {
  return DEMO_PULSE_ORDER.has(slug);
}

export function onPulse(topic: Pick<TopicRecord, "slug" | "lastMaterialChangeAt" | "status">): boolean {
  if (compileBlocked(topic.slug)) return false;
  if (topic.lastMaterialChangeAt) return true;
  return isDemoLaunchSlug(topic.slug) && topic.status !== "stub";
}

export function warehouseSourceList(sources: SourceRecord[], limit = WAREHOUSE_SOURCE_PAGE_LIMIT): SourceRecord[] {
  return [...sources]
    .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, limit);
}

export function latestEvidence(sources: SourceRecord[], limit = LATEST_EVIDENCE_LIMIT): SourceRecord[] {
  return warehouseSourceList(sources, limit);
}

export function movedToday(iso: string | null, now = new Date()): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === now.toISOString().slice(0, 10);
}

export function formatRelative(iso: string | null, now = new Date()): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "—";
  const hours = Math.max(0, Math.floor((now.getTime() - then) / 3_600_000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDate(iso);
}

export function lastRetrievedByTopicId(sources: SourceRecord[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const source of sources) {
    const topicId = topicIdFromSource(source);
    if (!topicId) continue;
    const prev = latest.get(topicId);
    if (!prev || source.retrievedAt > prev) latest.set(topicId, source.retrievedAt);
  }
  return latest;
}

export type RadarRow = {
  slug: string;
  name: string;
  kind: string;
  status: TopicRecord["status"];
  sourceCount: number;
  lastRetrievedAt: string | null;
  score: number;
};

/** Recency × source count. Radar is a signal strip, not a dump. Off-spine hubs stay out. */
export function radarTopics(graph: GraphSnapshot, now = new Date(), limit = RADAR_LIMIT): RadarRow[] {
  const counts = sourceCountsByTopicId(graph.sources);
  const retrieved = lastRetrievedByTopicId(graph.sources);
  const nowMs = now.getTime();
  const rows: RadarRow[] = [];
  for (const topic of graph.topics) {
    if (compileBlocked(topic.slug)) continue;
    const sourceCount = counts.get(topic.id) ?? 0;
    if (sourceCount <= 0) continue;
    const lastRetrievedAt = retrieved.get(topic.id) ?? null;
    const then = lastRetrievedAt ? Date.parse(lastRetrievedAt) : 0;
    const hours = Number.isFinite(then) && then > 0 ? Math.max(1, (nowMs - then) / 3_600_000) : 24 * 30;
    const score = sourceCount * (1 / (1 + hours / 24));
    rows.push({
      slug: topic.slug,
      name: topic.name,
      kind: topicKind(topic),
      status: topic.status,
      sourceCount,
      lastRetrievedAt,
      score,
    });
  }
  return rows.sort((a, b) => b.score - a.score || b.sourceCount - a.sourceCount || a.name.localeCompare(b.name)).slice(0, limit);
}

/** Demo spine first, then recency. Hugging Face and other compile-blocked hubs never appear. */
export function pulseTopics<T extends { slug: string }>(
  moved: T[],
  limit = PULSE_LIMIT,
): { visible: T[]; rest: T[] } {
  const eligible = moved.filter((row) => !compileBlocked(row.slug));
  const pinned = DEMO_LAUNCH_SLUGS.map((slug) => eligible.find((row) => row.slug === slug)).filter(
    (row): row is T => Boolean(row),
  );
  const pinnedSlugs = new Set(pinned.map((row) => row.slug));
  const restMoved = eligible.filter((row) => !pinnedSlugs.has(row.slug));
  const ordered = [...pinned, ...restMoved];
  return { visible: ordered.slice(0, limit), rest: ordered.slice(limit) };
}

export type IndexGroup = { kind: string; topics: Array<{ slug: string; name: string; status: TopicRecord["status"] }> };

const KIND_ORDER = ["person", "company", "product", "model", "policy", "standard", "event", "concept"];

export function topicIndex(graph: GraphSnapshot): IndexGroup[] {
  const buckets = new Map<string, IndexGroup["topics"]>();
  for (const topic of graph.topics) {
    const kind = topicKind(topic);
    const list = buckets.get(kind) ?? [];
    list.push({ slug: topic.slug, name: topic.name, status: topic.status });
    buckets.set(kind, list);
  }
  const kinds = [...buckets.keys()].sort((a, b) => {
    const ai = KIND_ORDER.indexOf(a);
    const bi = KIND_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });
  return kinds.map((kind) => ({
    kind,
    topics: (buckets.get(kind) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  }));
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
