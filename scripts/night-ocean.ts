import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestTopic } from "../src/lib/compiler/pipeline";
import {
  NIGHT_MAX_TIMEOUT_CYCLES,
  NIGHT_PRIORITY_SLUGS,
  NIGHT_SPEND_CEILING_USD,
  buildNightQueue,
  nextNightStopMs,
  nightSkipReason,
  nightSpendCeilingUsd,
  nightStopReason,
  type NightStopReason,
} from "../src/lib/compiler/night-policy";
import { formatNightReportMarkdown, summarizeOcean, type NightReport, type NightTopicResult } from "../src/lib/compiler/ocean-report";
import { ModelSpendCapError } from "../src/lib/compiler/spend";
import { StageTimeoutError } from "../src/lib/compiler/timeout";
import {
  COMPILE_MODEL_FALLBACK,
  MAX_DAILY_MODEL_SPEND_USD,
  OCEAN_HARD_STOP,
  PRIMARY_MODEL,
} from "../src/lib/env";
import { LAUNCH_DEMO_SLUG, SEED_ENTITIES } from "../src/lib/seed/entities";
import { getGraph, getTopicBySlug, modelSpendTodayUsd } from "../src/lib/store/json-store";

const PROGRESS_PATH = path.join(process.cwd(), "data", "ocean-night-progress.json");
const REPORT_JSON_PATH = path.join(process.cwd(), "artifacts", "ocean-night-report.json");
const REPORT_MD_PATH = path.join(process.cwd(), "artifacts", "OCEAN_REPORT.md");
const HARD_STOP_MS = Date.parse(OCEAN_HARD_STOP);

type NightProgress = {
  startedAt: string;
  stopAt: string;
  stopReason: NightStopReason | null;
  primaryModel: string;
  spendCeilingUsd: number;
  timeoutCycles: Record<string, number>;
  lastClaimsDelta: Record<string, number>;
  results: Record<string, NightTopicResult>;
};

function log(event: Record<string, unknown>): void {
  console.info(JSON.stringify({ kind: "ocean-night", ts: new Date().toISOString(), ...event }));
}

async function loadProgress(stopAt: string, spendCeilingUsd: number): Promise<NightProgress> {
  try {
    const prior = JSON.parse(await readFile(PROGRESS_PATH, "utf8")) as NightProgress;
    if (prior.startedAt && prior.results) {
      return {
        ...prior,
        stopAt: prior.stopAt || stopAt,
        spendCeilingUsd: prior.spendCeilingUsd || spendCeilingUsd,
        timeoutCycles: prior.timeoutCycles ?? {},
        lastClaimsDelta: prior.lastClaimsDelta ?? {},
        results: prior.results ?? {},
      };
    }
  } catch {
    // first night, or corrupt file
  }
  return {
    startedAt: new Date().toISOString(),
    stopAt,
    stopReason: null,
    primaryModel: PRIMARY_MODEL,
    spendCeilingUsd,
    timeoutCycles: {},
    lastClaimsDelta: {},
    results: {},
  };
}

async function saveProgress(progress: NightProgress): Promise<void> {
  await mkdir(path.dirname(PROGRESS_PATH), { recursive: true });
  await writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

async function snapshot(slug: string) {
  const topic = await getTopicBySlug(slug);
  const accepted = topic?.claims.filter((claim) => claim.status !== "rejected") ?? [];
  return {
    status: topic?.topic.status ?? "stub",
    sources: topic?.sources.length ?? 0,
    claims: accepted.length,
  };
}

async function writeReport(progress: NightProgress): Promise<NightReport> {
  const graph = await getGraph();
  const summary = summarizeOcean(graph);
  const attempted = Object.keys(progress.results);
  const report: NightReport = {
    kind: "ocean-night",
    startedAt: progress.startedAt,
    stoppedAt: new Date().toISOString(),
    stopReason: progress.stopReason,
    stopAt: progress.stopAt,
    primaryModel: progress.primaryModel,
    spendCeilingUsd: progress.spendCeilingUsd,
    spendTodayUsd: summary.spendTodayUsd,
    urls: summary.urls,
    claims: summary.claims,
    topics: summary.topics,
    whatMoved: summary.whatMoved,
    attempted,
    ok: attempted.filter((slug) => progress.results[slug]?.ok),
    skipped: attempted.filter((slug) => progress.results[slug]?.skipped),
    failures: attempted
      .filter((slug) => !progress.results[slug]?.ok && !progress.results[slug]?.skipped)
      .map((slug) => ({
        slug,
        error: progress.results[slug]?.error,
        timeout: progress.results[slug]?.timeout,
      })),
    results: progress.results,
  };
  await mkdir(path.dirname(REPORT_JSON_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, JSON.stringify(report, null, 2));
  await writeFile(REPORT_MD_PATH, formatNightReportMarkdown(report));
  return report;
}

async function main() {
  if (process.env.EXA_API_KEY) {
    throw new Error("EXA_API_KEY is set; ocean uses gateway.tools.exaSearch() only. Unset it.");
  }
  if (!Number.isFinite(HARD_STOP_MS)) {
    throw new Error(`Invalid OCEAN_HARD_STOP: ${OCEAN_HARD_STOP}`);
  }

  const spendCeilingUsd = nightSpendCeilingUsd(
    MAX_DAILY_MODEL_SPEND_USD,
    Number(process.env.OCEAN_NIGHT_SPEND_USD ?? NIGHT_SPEND_CEILING_USD),
  );
  const stopAtMs = nextNightStopMs();
  const progress = await loadProgress(new Date(stopAtMs).toISOString(), spendCeilingUsd);
  const graph = await getGraph();
  const officialSourceCount: Record<string, number> = {};
  for (const entity of SEED_ENTITIES) {
    officialSourceCount[entity.slug] = graph.sources.filter((source) =>
      entity.officialDomains.includes(source.publisherDomain),
    ).length;
  }
  const queue = buildNightQueue({
    seedSlugs: SEED_ENTITIES.map((entity) => entity.slug),
    prioritySlugs: NIGHT_PRIORITY_SLUGS,
    officialSourceCount,
    demoSlug: LAUNCH_DEMO_SLUG,
  });

  log({
    event: "start",
    primaryModel: PRIMARY_MODEL,
    compileModelFallback: COMPILE_MODEL_FALLBACK || null,
    stopAt: progress.stopAt,
    spendCeilingUsd,
    hardStop: OCEAN_HARD_STOP,
    queued: queue.length,
    resumed: Object.keys(progress.results).length,
  });

  for (const [index, slug] of queue.entries()) {
    const remaining = queue.length - index;
    const spend = await modelSpendTodayUsd();
    const stop = nightStopReason({
      nowMs: Date.now(),
      stopAtMs,
      spendUsd: spend,
      spendCeilingUsd,
      queueRemaining: remaining,
      hardStopMs: HARD_STOP_MS,
    });
    if (stop) {
      progress.stopReason = stop;
      log({ event: "stop", reason: stop, spend, remaining });
      break;
    }

    const live = await snapshot(slug);
    const prior = progress.results[slug];
    const skip = nightSkipReason({
      status: live.status,
      priorOk: Boolean(prior?.ok),
      timeoutCycles: progress.timeoutCycles[slug] ?? 0,
      lastClaimsDelta: progress.lastClaimsDelta[slug] ?? prior?.claimsDelta ?? null,
    });
    if (skip) {
      progress.results[slug] = {
        at: new Date().toISOString(),
        ok: skip === "already_ok" || skip === "strong",
        skipped: true,
        skipReason: skip,
        ...live,
        claimsDelta: 0,
      };
      log({ event: "skip", slug, reason: skip, ...live });
      await saveProgress(progress);
      continue;
    }

    const before = await snapshot(slug);
    log({ event: "ingest_start", slug, spend, ...before });
    try {
      await ingestTopic(slug);
      const after = await snapshot(slug);
      const claimsDelta = after.claims - before.claims;
      progress.lastClaimsDelta[slug] = claimsDelta;
      progress.results[slug] = {
        at: new Date().toISOString(),
        ok: true,
        ...after,
        claimsDelta,
      };
      log({ event: "ingest_ok", slug, claimsDelta, ...after });
    } catch (error) {
      const after = await snapshot(slug);
      const claimsDelta = after.claims - before.claims;
      progress.lastClaimsDelta[slug] = claimsDelta;
      const timeout = error instanceof StageTimeoutError;
      if (timeout && claimsDelta <= 0) {
        progress.timeoutCycles[slug] = (progress.timeoutCycles[slug] ?? 0) + 1;
      }
      const message = error instanceof Error ? error.message : "unknown";
      progress.results[slug] = {
        at: new Date().toISOString(),
        ok: false,
        error: message,
        timeout,
        spendCap: error instanceof ModelSpendCapError,
        ...after,
        claimsDelta,
      };
      log({
        event: "ingest_fail",
        slug,
        timeout,
        timeoutCycles: progress.timeoutCycles[slug] ?? 0,
        spendCap: error instanceof ModelSpendCapError,
        error: message,
        claimsDelta,
        ...after,
      });
      if (error instanceof ModelSpendCapError) {
        progress.stopReason = "spend";
        await saveProgress(progress);
        break;
      }
    }
    await saveProgress(progress);
    await writeReport(progress);
  }

  if (!progress.stopReason) {
    const leftover = queue.filter((slug) => !progress.results[slug]?.ok && !progress.results[slug]?.skipped);
    progress.stopReason = leftover.length === 0 ? "queue" : nightStopReason({
      nowMs: Date.now(),
      stopAtMs,
      spendUsd: await modelSpendTodayUsd(),
      spendCeilingUsd,
      queueRemaining: leftover.length,
      hardStopMs: HARD_STOP_MS,
    }) ?? "queue";
  }
  await saveProgress(progress);
  const report = await writeReport(progress);
  log({
    event: "done",
    stopReason: progress.stopReason,
    spend: report.spendTodayUsd,
    urls: report.urls,
    claims: report.claims,
    strong: report.topics.strong,
    provisional: report.topics.provisional,
    stub: report.topics.stub,
    whatMoved: report.whatMoved.length,
    ok: report.ok.length,
    failures: report.failures.length,
    report: REPORT_JSON_PATH,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
