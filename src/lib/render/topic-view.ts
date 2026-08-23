import { brand } from "@/lib/brand";
import type { TopicGraph } from "@/lib/store/graph";
import { robotsForStatus } from "@/lib/compiler/publication";

export function formatTime(iso: string | null): string {
  if (!iso) return "never";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function evidenceLabel(graph: TopicGraph, claimId: string): string {
  const claim = graph.claims.find((row) => row.id === claimId);
  if (!claim) return "0 sources";
  const domains = new Set(claim.evidence.map((row) => row.source.publisherDomain));
  const primary = claim.evidence.filter((row) => row.source.primaryStatus === "primary").length;
  return `${domains.size} independent source${domains.size === 1 ? "" : "s"}${primary ? ` · ${primary} primary` : ""}`;
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
