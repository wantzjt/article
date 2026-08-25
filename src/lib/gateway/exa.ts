import { gateway } from "ai";
import { EXA_NUM_RESULTS, EXA_SEARCH_TYPE } from "@/lib/env";
import { canonicalizeUrl, publisherDomain } from "@/lib/compiler/urls";
import type { ExaCategory } from "@/lib/compiler/taxonomy";

type ExaHit = {
  title?: string;
  url: string;
  author?: string | null;
  publishedDate?: string | null;
  text?: string;
  highlights?: string[];
};

type ExaToolOutput = {
  results?: ExaHit[];
  error?: string;
};

/**
 * Exa is reached only through Vercel AI Gateway / Eve promo:
 * `gateway.tools.exaSearch()` — no EXA_API_KEY, no Marketplace PAYG.
 * Promo: free through 2026-08-31 (see Vercel changelog).
 */
export function exaSearchTool(options?: {
  category?: "news" | "research paper" | "company" | "people" | "personal site" | "financial report";
  includeDomains?: string[];
  startPublishedDate?: string;
}) {
  return gateway.tools.exaSearch({
    type: EXA_SEARCH_TYPE,
    numResults: EXA_NUM_RESULTS,
    category: options?.category,
    includeDomains: options?.includeDomains,
    startPublishedDate: options?.startPublishedDate,
    contents: {
      highlights: { maxCharacters: 800 },
      text: { maxCharacters: 2000 },
    },
  });
}

export type DiscoveredSource = {
  url: string;
  canonicalUrl: string;
  title: string;
  publisherDomain: string;
  author: string | null;
  publishedAt: string | null;
  highlights: string[];
  query: string;
  exaCategory?: ExaCategory;
  queryTag?: string;
};

function isExaResponse(output: unknown): output is ExaToolOutput {
  return Boolean(output && typeof output === "object" && "results" in (output as object));
}

export function hitsFromExaOutput(
  output: unknown,
  query: string,
  extras?: { exaCategory?: ExaCategory; queryTag?: string },
): DiscoveredSource[] {
  if (!output || typeof output !== "object") return [];
  const obj = output as Record<string, unknown>;
  const nested = obj.result && typeof obj.result === "object" ? (obj.result as Record<string, unknown>) : null;
  const results = obj.results ?? nested?.results;
  if (!Array.isArray(results)) return [];
  const found: DiscoveredSource[] = [];
  for (const row of results) {
    const parsed = fromResult(row as ExaHit, query, extras);
    if (parsed) found.push(parsed);
  }
  return found;
}

function fromResult(
  result: ExaHit,
  query: string,
  extras?: { exaCategory?: ExaCategory; queryTag?: string },
): DiscoveredSource | null {
  try {
    const canonicalUrl = canonicalizeUrl(result.url);
    const excerpt =
      (result.highlights ?? []).join(" ").trim() || (result.text ?? "").slice(0, 2000);
    return {
      url: result.url,
      canonicalUrl,
      title: result.title || canonicalUrl,
      publisherDomain: publisherDomain(canonicalUrl),
      author: result.author ?? null,
      publishedAt: result.publishedDate ?? null,
      highlights: excerpt ? [excerpt] : [],
      query,
      exaCategory: extras?.exaCategory,
      queryTag: extras?.queryTag,
    };
  } catch {
    return null;
  }
}

export function collectExaSources(toolResults: unknown[], queries: string[]): DiscoveredSource[] {
  const found: DiscoveredSource[] = [];
  let queryIndex = 0;
  for (const row of toolResults) {
    const record = row as {
      toolName?: string;
      output?: unknown;
      input?: { query?: string };
    };
    if (record.toolName && record.toolName !== "exa_search") continue;
    const query = record.input?.query ?? queries[queryIndex] ?? "";
    queryIndex += 1;
    if (!isExaResponse(record.output) || !record.output.results) continue;
    for (const result of record.output.results) {
      const parsed = fromResult(result, query);
      if (parsed) found.push(parsed);
    }
  }
  const byUrl = new Map<string, DiscoveredSource>();
  for (const source of found) {
    const existing = byUrl.get(source.canonicalUrl);
    if (!existing) {
      byUrl.set(source.canonicalUrl, source);
      continue;
    }
    existing.highlights = [...new Set([...existing.highlights, ...source.highlights])];
  }
  return [...byUrl.values()];
}
