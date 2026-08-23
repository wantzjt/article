import type { PrimaryStatus, SourceType } from "./types";

const GITHUB = /(^|\.)github\.com$/i;
const ARXIV = /(^|\.)arxiv\.org$/i;
const GOV = /\.(gov|mil)$/i;
const SEC = /(^|\.)sec\.gov$/i;

export function classifySource(input: {
  domain: string;
  officialDomains: string[];
}): { sourceType: SourceType; primaryStatus: PrimaryStatus } {
  const domain = input.domain.toLowerCase().replace(/^www\./, "");
  const official = new Set(
    input.officialDomains.map((d) => d.toLowerCase().replace(/^www\./, "")),
  );

  if (official.has(domain) || [...official].some((d) => domain.endsWith(`.${d}`))) {
    return { sourceType: "official", primaryStatus: "primary" };
  }
  if (GITHUB.test(domain)) {
    return { sourceType: "github", primaryStatus: "primary" };
  }
  if (ARXIV.test(domain)) {
    return { sourceType: "arxiv", primaryStatus: "primary" };
  }
  if (SEC.test(domain) || GOV.test(domain)) {
    return { sourceType: "filing", primaryStatus: "primary" };
  }
  if (
    domain.includes("docs.") ||
    domain.startsWith("docs") ||
    domain.endsWith(".readthedocs.io")
  ) {
    return { sourceType: "docs", primaryStatus: "primary" };
  }
  if (
    /(nytimes|reuters|bloomberg|wsj|ft\.com|theverge|techcrunch|wired|arstechnica|semafor|theinformation)/i.test(
      domain,
    )
  ) {
    return { sourceType: "reporting", primaryStatus: "secondary" };
  }
  return { sourceType: "unknown", primaryStatus: "unknown" };
}
