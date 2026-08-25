import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  EXA_NUM_RESULTS,
  EXA_OCEAN_CONCURRENCY,
  OCEAN_HARD_STOP,
} from "../src/lib/env";
import { secondNightDecision, type NightLockFile } from "../src/lib/compiler/fail-closed";
import { mapPool } from "../src/lib/compiler/compile-chunk";
import {
  buildExaOceanQueue,
  discoveredToSourceRecords,
  exaOceanStopReason,
  formatExaOceanReportMarkdown,
  isExaHardStop,
  exaModelVehicleAllowed,
  type ExaOceanStopReason,
  type ExaOceanTopicResult,
} from "../src/lib/compiler/exa-ocean";
import { exaOceanPasses, topicKind } from "../src/lib/compiler/taxonomy";
import { invokeExaSearch } from "../src/lib/gateway/exa-invoke";
import { getOceanEntities } from "../src/lib/seed/broad";
import { FINANCE_SEED_SLUGS } from "../src/lib/seed/finance";
import * as store from "../src/lib/store/json-store";
import type { DiscoveredSource } from "../src/lib/gateway/exa";

const LOCK_PATH = path.join(process.cwd(), "data", "ocean-exa.lock");
const PROGRESS_PATH = path.join(process.cwd(), "data", "ocean-exa-progress.json");
const REPORT_JSON = path.join(process.cwd(), "artifacts", "exa-ocean-report.json");
const REPORT_MD = path.join(process.cwd(), "artifacts", "exa-ocean-report.md");
const HARD_STOP_MS = Date.parse(OCEAN_HARD_STOP);

type Progress = {
  startedAt: string;
  stopReason: ExaOceanStopReason | null;
  sha: string;
  claimsAtStart: number;
  urlsAtStart: number;
  stubsCreated: string[];
  gatewayVehicleCostUsd: number;
  rateLimits: number;
  errors: string[];
  completed: string[];
  pass: number;
  results: Record<string, ExaOceanTopicResult>;
};

function log(event: Record<string, unknown>): void {
  console.info(JSON.stringify({ kind: "ocean-exa", ts: new Date().toISOString(), ...event }));
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readLock(): Promise<NightLockFile | null> {
  try {
    return JSON.parse(await readFile(LOCK_PATH, "utf8")) as NightLockFile;
  } catch {
    return null;
  }
}

async function writeLock(): Promise<void> {
  await mkdir(path.dirname(LOCK_PATH), { recursive: true });
  await writeFile(LOCK_PATH, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2));
}

async function releaseLock(): Promise<void> {
  try {
    await unlink(LOCK_PATH);
  } catch {
    // gone
  }
}

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: process.cwd() }).toString().trim();
  } catch {
    return "unknown";
  }
}

async function loadProgress(): Promise<Progress> {
  try {
    const prior = JSON.parse(await readFile(PROGRESS_PATH, "utf8")) as Progress;
    if (prior.startedAt && prior.results) return prior;
  } catch {
    // first run
  }
  const graph = await store.getGraph();
  return {
    startedAt: new Date().toISOString(),
    stopReason: null,
    sha: gitSha(),
    claimsAtStart: graph.claims.length,
    urlsAtStart: graph.sources.length,
    stubsCreated: [],
    gatewayVehicleCostUsd: 0,
    rateLimits: 0,
    errors: [],
    completed: [],
    pass: 1,
    results: {},
  };
}

async function saveProgress(progress: Progress): Promise<void> {
  await mkdir(path.dirname(PROGRESS_PATH), { recursive: true });
  await writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

async function writeReport(progress: Progress): Promise<void> {
  const graph = await store.getGraph();
  const sourceCounts: Record<string, number> = {};
  for (const topic of graph.topics) {
    sourceCounts[topic.slug] = graph.sources.filter((source) => source.metadata?.topicId === topic.id).length;
  }
  const gainers = Object.values(progress.results)
    .filter((row) => row.sourcesAdded > 0)
    .sort((a, b) => b.sourcesAdded - a.sourcesAdded)
    .slice(0, 12)
    .map((row) => ({ slug: row.slug, added: row.sourcesAdded, hits: row.hits }));
  const stillThin = getOceanEntities()
    .map((entity) => ({ slug: entity.slug, sources: sourceCounts[entity.slug] ?? 0 }))
    .sort((a, b) => a.sources - b.sources)
    .slice(0, 12);
  const payload = {
    kind: "ocean-exa",
    sha: progress.sha,
    startedAt: progress.startedAt,
    stoppedAt: new Date().toISOString(),
    stopReason: progress.stopReason,
    hardStopAt: OCEAN_HARD_STOP,
    urlsBefore: progress.urlsAtStart,
    urlsAfter: graph.sources.length,
    claimsBefore: progress.claimsAtStart,
    claimsAfter: graph.claims.length,
    stubsCreated: progress.stubsCreated.length,
    modelSpendUsd: 0,
    gatewayVehicleCostUsd: progress.gatewayVehicleCostUsd,
    rateLimits: progress.rateLimits,
    errors: progress.errors.slice(-30),
    topGainers: gainers,
    stillThin,
    attempted: Object.keys(progress.results).length,
    ok: Object.values(progress.results).filter((row) => row.ok).length,
    pass: progress.pass,
    claimsUnchanged: graph.claims.length === progress.claimsAtStart,
  };
  await mkdir(path.dirname(REPORT_JSON), { recursive: true });
  await writeFile(REPORT_JSON, JSON.stringify(payload, null, 2));
  await writeFile(REPORT_MD, formatExaOceanReportMarkdown(payload));
}

async function ensureTopic(slug: string, created: string[]): Promise<{ id: string; createdStub: boolean }> {
  const entity = getOceanEntities().find((row) => row.slug === slug);
  if (!entity) throw new Error(`Unknown ocean entity: ${slug}`);
  const existing = await store.getTopicBySlug(slug);
  if (existing) return { id: existing.topic.id, createdStub: false };
  const topic = await store.upsertTopic({
    id: `topic_${slug}`,
    slug: entity.slug,
    name: entity.name,
    entityType: entity.entityType,
    kind: topicKind(entity),
    description: entity.description,
    aliases: entity.aliases,
    officialDomains: entity.officialDomains,
    status: "stub",
    lastVerifiedAt: null,
    lastMaterialChangeAt: null,
  });
  created.push(slug);
  return { id: topic.id, createdStub: true };
}

async function discoverTopic(slug: string, pass: number): Promise<ExaOceanTopicResult> {
  const started = Date.now();
  const entity = getOceanEntities().find((row) => row.slug === slug);
  if (!entity) throw new Error(`Unknown ocean entity: ${slug}`);
  const { id: topicId, createdStub } = await ensureTopic(slug, []);
  const passes = exaOceanPasses(entity);
  const errors: string[] = [];
  const allHits: DiscoveredSource[] = [];
  let gatewayCost = 0;
  let rateLimits = 0;

  const results = await mapPool(passes, Math.min(passes.length, EXA_OCEAN_CONCURRENCY), async (pass) => {
    if (isExaHardStop(Date.now(), HARD_STOP_MS)) {
      return { query: pass.query, hits: [] as DiscoveredSource[], gatewayCostUsd: 0, rateLimit: false, error: "hard_stop" };
    }
    const invoked = await invokeExaSearch({
      query: pass.query,
      category: pass.category,
      queryTag: pass.queryTag,
      includeDomains: pass.includeDomains,
      startPublishedDate: new Date(Date.now() - 400 * 86400000).toISOString(),
    });
    return {
      query: pass.query,
      hits: invoked.hits,
      gatewayCostUsd: invoked.gatewayCostUsd,
      rateLimit: invoked.error?.kind === "rate_limit",
      quota: invoked.error?.kind === "quota",
      error: invoked.error?.message,
    };
  });

  for (const row of results) {
    gatewayCost += row.gatewayCostUsd;
    if (row.rateLimit) rateLimits += 1;
    if (row.error && row.error !== "hard_stop") errors.push(`${row.query}: ${row.error}`.slice(0, 240));
    allHits.push(...row.hits);
  }

  const byUrl = new Map((await store.listSources()).map((source) => [source.canonicalUrl, source]));
  const mapped = discoveredToSourceRecords({
    hits: allHits,
    entity,
    topicId,
    existingByUrl: byUrl,
  });
  if (mapped.pending.length) await store.upsertSources(mapped.pending);

  return {
    slug,
    ok: mapped.urls.length > 0 || mapped.unchanged > 0,
    pass,
    queriesRun: passes.length,
    hits: mapped.urls.length,
    sourcesAdded: mapped.added,
    sourcesUnchanged: mapped.unchanged,
    durationMs: Date.now() - started,
    errors,
    createdStub,
    gatewayCostUsd: gatewayCost,
  };
}

async function main() {
  if (process.argv.includes("--compile")) {
    throw new Error("ocean:exa is discover-only. Do not pass --compile.");
  }
  if (process.env.EXA_API_KEY) {
    throw new Error("EXA_API_KEY is set; ocean:exa uses gateway.tools.exaSearch() only.");
  }
  if (!Number.isFinite(HARD_STOP_MS)) {
    throw new Error(`Invalid OCEAN_HARD_STOP: ${OCEAN_HARD_STOP}`);
  }

  const existingLock = await readLock();
  const decision = secondNightDecision({
    lock: existingLock,
    currentPid: process.pid,
    lockPidAlive: existingLock ? pidAlive(existingLock.pid) : false,
  });
  if (decision === "refuse") {
    log({ event: "refuse_second_instance", pid: existingLock?.pid });
    console.error(`ocean:exa already running (pid ${existingLock?.pid}).`);
    process.exit(2);
  }

  const progress = await loadProgress();
  progress.stopReason = null;
  if (!exaModelVehicleAllowed()) {
    progress.stopReason = "protect";
    progress.errors.push(
      "Blocked: gateway.tools.exaSearch() still executes only as a provider tool on a language-model request, which bills TARX Gateway credits. EXA_ALLOW_MODEL_VEHICLE is unset. Protecting the ~$10 float. Free Exa promo is unused until a tools-only path exists or PM sets EXA_ALLOW_MODEL_VEHICLE=1.",
    );
    await saveProgress(progress);
    await writeReport(progress);
    log({ event: "refuse_model_vehicle", creditsProtect: true });
    process.exit(0);
  }
  let signaled = false;
  const onSignal = async () => {
    if (signaled) return;
    signaled = true;
    progress.stopReason = "signal";
    await saveProgress(progress);
    await writeReport(progress);
    await releaseLock();
    process.exit(0);
  };
  process.on("SIGINT", () => void onSignal());
  process.on("SIGTERM", () => void onSignal());

  await writeLock();
  const finance = new Set(FINANCE_SEED_SLUGS);
  const entities = getOceanEntities().filter((row) => !finance.has(row.slug));
  const slugs = entities.map((row) => row.slug);

  log({
    event: "start",
    sha: progress.sha,
    entities: slugs.length,
    numResults: EXA_NUM_RESULTS,
    concurrency: EXA_OCEAN_CONCURRENCY,
    hardStop: OCEAN_HARD_STOP,
    resumed: progress.completed.length,
    claimsAtStart: progress.claimsAtStart,
    urlsAtStart: progress.urlsAtStart,
  });

  async function runPass(thinPass: boolean): Promise<void> {
    const graph = await store.getGraph();
    const sourceCounts: Record<string, number> = {};
    for (const topic of graph.topics) {
      sourceCounts[topic.slug] = graph.sources.filter((source) => source.metadata?.topicId === topic.id).length;
    }
    const completed = thinPass ? [] : progress.completed;
    const queue = buildExaOceanQueue({
      slugs,
      completed,
      sourceCounts,
      thinPass,
    });
    progress.pass = thinPass ? 2 : 1;
    const topicConcurrency = Math.max(1, Math.min(4, Math.floor(EXA_OCEAN_CONCURRENCY / 6) || 1));
    let index = 0;
    async function worker() {
      while (index < queue.length && !signaled) {
        const stop = exaOceanStopReason({
          nowMs: Date.now(),
          hardStopMs: HARD_STOP_MS,
          queueRemaining: queue.length - index,
          signaled,
        });
        if (stop) {
          progress.stopReason = stop;
          return;
        }
        const current = index;
        index += 1;
        const slug = queue[current];
        log({ event: "topic_start", slug, pass: progress.pass, remaining: queue.length - current });
        try {
          const result = await discoverTopic(slug, progress.pass);
          progress.results[`${progress.pass}:${slug}`] = result;
          if (!thinPass) progress.completed.push(slug);
          progress.gatewayVehicleCostUsd += result.gatewayCostUsd;
          progress.rateLimits += result.errors.filter((row) => /429|rate/i.test(row)).length;
          progress.errors.push(...result.errors);
          if (result.createdStub) progress.stubsCreated.push(slug);
          if (result.errors.some((row) => /budget exceeded|quota_for_entity/i.test(row))) {
            progress.stopReason = "quota";
            signaled = true;
          }
          log({
            event: "topic_ok",
            slug,
            queriesRun: result.queriesRun,
            hits: result.hits,
            sourcesAdded: result.sourcesAdded,
            sourcesUnchanged: result.sourcesUnchanged,
            durationMs: result.durationMs,
            errors: result.errors.length,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "topic_failed";
          progress.errors.push(`${slug}: ${message}`);
          log({ event: "topic_err", slug, error: message });
        }
        await saveProgress(progress);
        await writeReport(progress);
      }
    }
    await Promise.all(Array.from({ length: topicConcurrency }, () => worker()));
  }

  await runPass(false);
  if (!signaled && !isExaHardStop(Date.now(), HARD_STOP_MS)) {
    log({ event: "thin_pass" });
    await runPass(true);
  }
  if (!progress.stopReason) {
    progress.stopReason = isExaHardStop(Date.now(), HARD_STOP_MS) ? "hard_stop" : "queue";
  }
  const graph = await store.getGraph();
  if (graph.claims.length !== progress.claimsAtStart) {
    progress.errors.push(`claims_changed ${progress.claimsAtStart} -> ${graph.claims.length}`);
  }
  await saveProgress(progress);
  await writeReport(progress);
  await releaseLock();
  log({ event: "done", stopReason: progress.stopReason, urls: (await store.getGraph()).sources.length });
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try {
    await releaseLock();
  } catch {
    // ignore
  }
  process.exit(1);
});
