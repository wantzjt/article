import { EXA_OCEAN_CONCURRENCY } from "@/lib/env";
import type { DiscoveredSource } from "@/lib/gateway/exa";
import { invokeExaSearch } from "@/lib/gateway/exa-invoke";
import { mergeTopicEntityMeta } from "./exa-entity";
import { discoveredToSourceRecords, isExaHardStop, type ExaOceanTopicResult } from "./exa-ocean";
import { mapPool } from "./compile-chunk";
import { exaOceanPasses } from "./taxonomy";
import type { SeedEntity } from "./types";
import * as store from "@/lib/store/json-store";

/**
 * Warehouse-only discover for one entity. No extract/verify/render.
 */
export async function discoverSourcesForEntity(input: {
  entity: SeedEntity;
  topicId: string;
  pass: number;
  hardStopMs: number;
}): Promise<ExaOceanTopicResult> {
  const started = Date.now();
  const passes = exaOceanPasses(input.entity);
  const errors: string[] = [];
  const allHits: DiscoveredSource[] = [];
  let gatewayCost = 0;

  const results = await mapPool(passes, Math.min(passes.length, EXA_OCEAN_CONCURRENCY), async (pass) => {
    if (isExaHardStop(Date.now(), input.hardStopMs)) {
      return { hits: [] as DiscoveredSource[], gatewayCostUsd: 0, error: "hard_stop" };
    }
    const invoked = await invokeExaSearch({
      query: pass.query,
      category: pass.category,
      queryTag: pass.queryTag,
      includeDomains: pass.includeDomains,
      startPublishedDate: new Date(Date.now() - 400 * 86400000).toISOString(),
    });
    return {
      hits: invoked.hits,
      gatewayCostUsd: invoked.gatewayCostUsd,
      error: invoked.error?.message,
    };
  });

  for (const row of results) {
    gatewayCost += row.gatewayCostUsd;
    if (row.error && row.error !== "hard_stop") errors.push(row.error.slice(0, 240));
    allHits.push(...row.hits);
  }

  let queriesRun = passes.length;
  if (allHits.length === 0 && !isExaHardStop(Date.now(), input.hardStopMs)) {
    const alias = input.entity.aliases[0] ?? "";
    const retries = [
      { query: `${input.entity.name} ${alias} news`.trim(), category: "news" as const, queryTag: "retry.news" },
      { query: `${input.entity.name} official`.trim(), category: "web" as const, queryTag: "retry.web" },
    ];
    for (const retry of retries) {
      if (isExaHardStop(Date.now(), input.hardStopMs)) break;
      const invoked = await invokeExaSearch({
        query: retry.query,
        category: retry.category,
        queryTag: retry.queryTag,
        startPublishedDate: new Date(Date.now() - 400 * 86400000).toISOString(),
      });
      queriesRun += 1;
      gatewayCost += invoked.gatewayCostUsd;
      if (invoked.error?.message) errors.push(`retry ${retry.queryTag}: ${invoked.error.message}`.slice(0, 240));
      allHits.push(...invoked.hits);
      if (invoked.hits.length > 0) break;
    }
  }

  const byUrl = new Map((await store.listSources()).map((source) => [source.canonicalUrl, source]));
  const mapped = discoveredToSourceRecords({
    hits: allHits,
    entity: input.entity,
    topicId: input.topicId,
    existingByUrl: byUrl,
  });
  if (mapped.pending.length) await store.upsertSources(mapped.pending);
  if (mapped.entityMeta) {
    const topic = await store.getTopicById(input.topicId);
    if (topic) {
      const entityMeta = mergeTopicEntityMeta(topic.entityMeta, mapped.entityMeta);
      if (entityMeta && JSON.stringify(entityMeta) !== JSON.stringify(topic.entityMeta ?? null)) {
        await store.patchTopicEntityMeta(topic.id, entityMeta);
      }
    }
  }

  return {
    slug: input.entity.slug,
    ok: mapped.urls.length > 0 || mapped.unchanged > 0,
    pass: input.pass,
    queriesRun,
    hits: mapped.urls.length,
    sourcesAdded: mapped.added,
    sourcesUnchanged: mapped.unchanged,
    durationMs: Date.now() - started,
    errors,
    createdStub: false,
    gatewayCostUsd: gatewayCost,
  };
}
