import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestTopic } from "../src/lib/compiler/pipeline";
import { ModelSpendCapError } from "../src/lib/compiler/spend";
import { StageTimeoutError } from "../src/lib/compiler/timeout";
import {
  COMPILE_MODEL_FALLBACK,
  GLM_52_FREE_UNTIL,
  MAX_DAILY_MODEL_SPEND_USD,
  OCEAN_HARD_STOP,
  PRIMARY_MODEL,
  isGlm52FreeWindow,
} from "../src/lib/env";
import { LAUNCH_DEMO_SLUG, SEED_ENTITIES } from "../src/lib/seed/entities";
import { getGraph, getTopicBySlug, modelSpendTodayUsd } from "../src/lib/store/json-store";

const PROGRESS_PATH = path.join(process.cwd(), "data", "ocean-progress.json");
const HARD_STOP_MS = Date.parse(OCEAN_HARD_STOP);

type TopicResult = {
  at: string;
  ok: boolean;
  error?: string;
  status?: string;
  sources?: number;
  claims?: number;
};

type Progress = {
  startedAt: string;
  hardStop: string;
  results: Record<string, TopicResult>;
};

function pastHardStop(now = Date.now()): boolean {
  return now >= HARD_STOP_MS;
}

function log(event: Record<string, unknown>): void {
  console.info(JSON.stringify({ kind: "ocean", ts: new Date().toISOString(), ...event }));
}

async function loadProgress(): Promise<Progress> {
  try {
    return JSON.parse(await readFile(PROGRESS_PATH, "utf8")) as Progress;
  } catch {
    return {
      startedAt: new Date().toISOString(),
      hardStop: OCEAN_HARD_STOP,
      results: {},
    };
  }
}

async function saveProgress(progress: Progress): Promise<void> {
  await mkdir(path.dirname(PROGRESS_PATH), { recursive: true });
  await writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

function msUntilNextUtcDay(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 1, 0);
  return Math.max(60_000, next - now.getTime());
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

async function main() {
  if (process.env.EXA_API_KEY) {
    throw new Error("EXA_API_KEY is set; ocean uses gateway.tools.exaSearch() only. Unset it.");
  }
  if (!Number.isFinite(HARD_STOP_MS)) {
    throw new Error(`Invalid OCEAN_HARD_STOP: ${OCEAN_HARD_STOP}`);
  }

  const progress = await loadProgress();
  const graph = await getGraph();
  log({
    event: "start",
    hardStop: OCEAN_HARD_STOP,
    primaryModel: PRIMARY_MODEL,
    compileModelFallback: COMPILE_MODEL_FALLBACK || null,
    glm52FreeUntil: GLM_52_FREE_UNTIL,
    glm52FreeWindow: isGlm52FreeWindow(),
    maxDailyModelSpendUsd: MAX_DAILY_MODEL_SPEND_USD,
    topics: SEED_ENTITIES.length,
    graphSources: graph.sources.length,
    graphClaims: graph.claims.length,
  });

  const graphForQueue = await getGraph();
  const officialCount = (slug: string) => {
    const entity = SEED_ENTITIES.find((row) => row.slug === slug);
    if (!entity) return 0;
    return graphForQueue.sources.filter((source) => entity.officialDomains.includes(source.publisherDomain))
      .length;
  };
  const claimCount = (topicId: string) =>
    graphForQueue.claims.filter((claim) => claim.topicId === topicId && claim.status !== "rejected").length;
  const queue = [...SEED_ENTITIES]
    .filter((entity) => entity.slug !== LAUNCH_DEMO_SLUG)
    .sort((a, b) => {
      const topicA = graphForQueue.topics.find((row) => row.slug === a.slug);
      const topicB = graphForQueue.topics.find((row) => row.slug === b.slug);
      const claims = claimCount(topicB?.id ?? "") - claimCount(topicA?.id ?? "");
      if (claims !== 0) return claims;
      return officialCount(b.slug) - officialCount(a.slug);
    });
  queue.push(...SEED_ENTITIES.filter((entity) => entity.slug === LAUNCH_DEMO_SLUG));

  for (const entity of queue) {
    if (pastHardStop()) {
      log({ event: "hard_stop", slug: entity.slug });
      break;
    }

    const live = await snapshot(entity.slug);
    const prior = progress.results[entity.slug];
    if (prior?.ok || live.status === "strong") continue;

    let spend = await modelSpendTodayUsd();
    if (spend >= MAX_DAILY_MODEL_SPEND_USD) {
      const waitMs = msUntilNextUtcDay();
      if (Date.now() + waitMs >= HARD_STOP_MS) {
        log({ event: "hard_stop_before_next_day", spend });
        break;
      }
      log({ event: "model_cap_wait", spend, waitMs });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      if (pastHardStop()) break;
      spend = await modelSpendTodayUsd();
    }

    const before = await snapshot(entity.slug);
    log({ event: "ingest_start", slug: entity.slug, spend, ...before });
    try {
      await ingestTopic(entity.slug);
      const after = await snapshot(entity.slug);
      progress.results[entity.slug] = {
        at: new Date().toISOString(),
        ok: true,
        ...after,
      };
      log({ event: "ingest_ok", slug: entity.slug, ...after });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      const after = await snapshot(entity.slug);
      progress.results[entity.slug] = {
        at: new Date().toISOString(),
        ok: false,
        error: message,
        ...after,
      };
      log({
        event: "ingest_fail",
        slug: entity.slug,
        timeout: error instanceof StageTimeoutError,
        spendCap: error instanceof ModelSpendCapError,
        error: message,
        ...after,
      });
      if (error instanceof ModelSpendCapError) {
        await saveProgress(progress);
        const waitMs = msUntilNextUtcDay();
        if (Date.now() + waitMs >= HARD_STOP_MS) break;
        log({ event: "model_cap_wait", spend: await modelSpendTodayUsd(), waitMs });
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
    await saveProgress(progress);
  }

  const end = await getGraph();
  const touched = Object.keys(progress.results);
  const ok = touched.filter((slug) => progress.results[slug]?.ok);
  log({
    event: "done",
    hardStop: pastHardStop(),
    spend: await modelSpendTodayUsd(),
    graphSources: end.sources.length,
    graphClaims: end.claims.length,
    attempted: touched.length,
    ok: ok.length,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
