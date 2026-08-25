import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ingestTopic } from "../src/lib/compiler/pipeline";
import { classifySource } from "../src/lib/compiler/primary";
import { contentHash } from "../src/lib/compiler/hash";
import { canonicalizeUrl } from "../src/lib/compiler/urls";
import {
  FINANCE_FILING_DOMAINS,
  FINANCE_WIRE_DOMAINS,
  financeDiscoverQueries,
  isForbiddenFinanceDomain,
} from "../src/lib/compiler/finance";
import { generateWithExaSearch } from "../src/lib/gateway/ai";
import { collectExaSources, exaSearchTool } from "../src/lib/gateway/exa";
import { FINANCE_SEED_ENTITIES } from "../src/lib/seed/finance";
import { getEntityBySlug } from "../src/lib/seed/entities";
import * as store from "../src/lib/store/json-store";
import type { SourceRecord } from "../src/lib/compiler/types";

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function log(event: Record<string, unknown>): void {
  console.info(JSON.stringify({ kind: "finance-discover", ts: new Date().toISOString(), ...event }));
}

async function persistDiscover(
  slug: string,
  options: { persist: boolean },
): Promise<{ sources: number; urls: string[]; model: string; costUsd: number; added: number }> {
  const entity = getEntityBySlug(slug);
  if (!entity) throw new Error(`Unknown seed entity: ${slug}`);
  if (process.env.EXA_API_KEY) {
    throw new Error("EXA_API_KEY is set; finance discover uses gateway.tools.exaSearch() only.");
  }

  let topicId = `topic_${slug}`;
  if (options.persist) {
    const existing = await store.getTopicBySlug(slug);
    const topic = await store.upsertTopic({
      id: existing?.topic.id ?? `topic_${slug}`,
      slug: entity.slug,
      name: entity.name,
      entityType: entity.entityType,
      description: existing?.topic.description || entity.description,
      aliases: entity.aliases,
      officialDomains: entity.officialDomains,
      status: existing?.topic.status ?? "stub",
      lastVerifiedAt: existing?.topic.lastVerifiedAt ?? null,
      lastMaterialChangeAt: existing?.topic.lastMaterialChangeAt ?? null,
    });
    topicId = topic.id;
  }

  const queries = financeDiscoverQueries(entity.name, entity.officialDomains[0]);
  const includeDomains = [
    ...new Set([...entity.officialDomains, ...FINANCE_FILING_DOMAINS, ...FINANCE_WIRE_DOMAINS]),
  ];
  const { result, meta } = await generateWithExaSearch({
    stage: "discover",
    topicId,
    maxSteps: 8,
    exa: exaSearchTool({
      category: "news",
      includeDomains,
      startPublishedDate: new Date(Date.now() - 400 * 86400000).toISOString(),
    }),
    system:
      "You retrieve primary evidence for capital events. You MUST call exa_search at least twice. Prefer official IR/press, reputable wires, and SEC filings. Do not invent URLs. Do not use Crunchbase or PitchBook as a source of record.",
    prompt: `Topic: ${entity.name} (${entity.slug})\nOfficial domains: ${entity.officialDomains.join(", ")}\nRun:\n- ${queries.join("\n- ")}`,
  });
  if (options.persist) {
    await store.recordSpend({
      stage: "discover",
      topicId,
      model: meta.model,
      costUsd: meta.costUsd,
    });
  }

  const toolRows = (result.toolResults ?? []) as Array<{ toolName?: string }>;
  log({
    event: "exa_tools",
    tools: toolRows.map((row) => row.toolName ?? "unknown"),
    toolResults: toolRows.length,
  });
  const discovered = collectExaSources(result.toolResults ?? [], queries).filter(
    (hit) => !isForbiddenFinanceDomain(hit.publisherDomain),
  );
  const pending: SourceRecord[] = [];
  const urls: string[] = [];
  for (const hit of discovered) {
    const canonicalUrl = canonicalizeUrl(hit.canonicalUrl);
    const excerpt = (hit.highlights.join(" ") || "").slice(0, 800);
    const hash = contentHash([canonicalUrl, hit.title, excerpt]);
    const prior = options.persist ? await store.findSourceByUrl(canonicalUrl) : null;
    if (prior && prior.contentHash === hash) {
      urls.push(canonicalUrl);
      continue;
    }
    const classified = classifySource({
      domain: hit.publisherDomain,
      officialDomains: entity.officialDomains,
    });
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
      metadata: { query: hit.query, via: "ai-gateway:exaSearch", arm: "finance" },
    });
    urls.push(canonicalUrl);
  }
  if (options.persist) await store.upsertSources(pending);
  log({
    event: "discover_ok",
    slug,
    persist: options.persist,
    model: meta.model,
    costUsd: meta.costUsd,
    sources: urls.length,
    added: pending.length,
  });
  return { sources: urls.length, urls, model: meta.model, costUsd: meta.costUsd, added: pending.length };
}

async function main() {
  const compile = argFlag("--compile");
  const dryRun = argFlag("--dry-run");
  if (compile && dryRun) throw new Error("Cannot combine --compile with --dry-run.");
  const positional = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
  const target = argValue("--slug") ?? positional ?? "andreessen-horowitz";
  if (!getEntityBySlug(target)) {
    throw new Error(`Unknown finance slug: ${target}`);
  }
  log({
    event: "start",
    slug: target,
    compile,
    dryRun,
    count: FINANCE_SEED_ENTITIES.length,
  });
  const discovered = await persistDiscover(target, { persist: !dryRun });
  if (compile) {
    const result = await ingestTopic(target);
    log({ event: "compile_ok", slug: target, ...result });
  }
  const summary = {
    ok: true,
    slug: target,
    compile,
    dryRun,
    persist: !dryRun,
    model: discovered.model,
    costUsd: discovered.costUsd,
    sources: discovered.sources,
    added: discovered.added,
    urls: discovered.urls.slice(0, 12),
  };
  if (dryRun) {
    const outDir = path.join(process.cwd(), "artifacts");
    await mkdir(outDir, { recursive: true });
    await writeFile(
      path.join(outDir, "finance-discover-dry-run.json"),
      JSON.stringify({ ...summary, urls: discovered.urls, ranAt: new Date().toISOString() }, null, 2),
    );
  }
  console.info(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
