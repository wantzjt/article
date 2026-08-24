import { brand } from "@/lib/brand";
import type { TopicGraph } from "@/lib/store/graph";
import { robotsForStatus } from "@/lib/compiler/publication";

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
