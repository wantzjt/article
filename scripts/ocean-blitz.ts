import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  EXA_CREDIT_FLOOR_USD,
  EXA_OCEAN_SESSION_CEILING_USD,
  EXA_VEHICLE_MODEL,
  OCEAN_HARD_STOP,
} from "../src/lib/env";
import { secondNightDecision, type NightLockFile } from "../src/lib/compiler/fail-closed";
import { discoverSourcesForEntity } from "../src/lib/compiler/exa-discover";
import {
  exaModelVehicleAllowed,
  exaOceanStopReason,
  isExaHardStop,
  resolveExaVehicleModel,
  type ExaOceanStopReason,
  type ExaOceanTopicResult,
} from "../src/lib/compiler/exa-ocean";
import { proposeFrontier, type FrontierEdge } from "../src/lib/compiler/frontier";
import { topicKind } from "../src/lib/compiler/taxonomy";
import { readGatewayCredits } from "../src/lib/gateway/exa-invoke";
import { getFrontierSeedEntities } from "../src/lib/seed/frontier";
import * as store from "../src/lib/store/json-store";
import type { SeedEntity } from "../src/lib/compiler/types";

const LOCK_PATH = path.join(process.cwd(), "data", "ocean-blitz.lock");
const PROGRESS_PATH = path.join(process.cwd(), "data", "ocean-blitz-progress.json");
const EDGES_PATH = path.join(process.cwd(), "data", "frontier-edges.json");
const REPORT_JSON = path.join(process.cwd(), "artifacts", "blitz-report.json");
const REPORT_MD = path.join(process.cwd(), "artifacts", "blitz-report.md");
const HARD_STOP_MS = Date.parse(OCEAN_HARD_STOP);

type Progress = {
  startedAt: string;
  stopReason: ExaOceanStopReason | null;
  sha: string;
  urlsAtStart: number;
  topicsAtStart: number;
  peopleAtStart: number;
  claimsAtStart: number;
  stubsCreated: string[];
  peopleCreated: string[];
  duplicatesRejected: number;
  gatewayVehicleCostUsd: number;
  errors: string[];
  completed: string[];
  results: Record<string, ExaOceanTopicResult>;
};

function log(event: Record<string, unknown>): void {
  console.info(JSON.stringify({ kind: "ocean-blitz", ts: new Date().toISOString(), ...event }));
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: process.cwd() }).toString().trim();
  } catch {
    return "unknown";
  }
}

function peopleCount(graph: Awaited<ReturnType<typeof store.getGraph>>): number {
  return graph.topics.filter((topic) => topicKind(topic) === "person").length;
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
    urlsAtStart: graph.sources.length,
    topicsAtStart: graph.topics.length,
    peopleAtStart: peopleCount(graph),
    claimsAtStart: graph.claims.length,
    stubsCreated: [],
    peopleCreated: [],
    duplicatesRejected: 0,
    gatewayVehicleCostUsd: 0,
    errors: [],
    completed: [],
    results: {},
  };
}

async function saveProgress(progress: Progress): Promise<void> {
  await mkdir(path.dirname(PROGRESS_PATH), { recursive: true });
  await writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

async function writeEdges(edges: FrontierEdge[]): Promise<void> {
  let prior: FrontierEdge[] = [];
  try {
    prior = JSON.parse(await readFile(EDGES_PATH, "utf8")) as FrontierEdge[];
  } catch {
    prior = [];
  }
  const key = (row: FrontierEdge) => `${row.from}|${row.to}|${row.kind}`;
  const map = new Map(prior.map((row) => [key(row), row]));
  for (const edge of edges) map.set(key(edge), edge);
  await mkdir(path.dirname(EDGES_PATH), { recursive: true });
  await writeFile(EDGES_PATH, JSON.stringify([...map.values()], null, 2));
}

async function writeReport(progress: Progress): Promise<void> {
  const graph = await store.getGraph();
  const payload = {
    kind: "ocean-blitz",
    sha: progress.sha,
    startedAt: progress.startedAt,
    stoppedAt: new Date().toISOString(),
    stopReason: progress.stopReason,
    urlsBefore: progress.urlsAtStart,
    urlsAfter: graph.sources.length,
    topicsBefore: progress.topicsAtStart,
    topicsAfter: graph.topics.length,
    peopleBefore: progress.peopleAtStart,
    peopleAfter: peopleCount(graph),
    claimsBefore: progress.claimsAtStart,
    claimsAfter: graph.claims.length,
    stubsCreated: progress.stubsCreated,
    peopleCreated: progress.peopleCreated,
    duplicatesRejected: progress.duplicatesRejected,
    gatewayVehicleCostUsd: progress.gatewayVehicleCostUsd,
    attempted: Object.keys(progress.results).length,
    ok: Object.values(progress.results).filter((row) => row.ok).length,
    failed: progress.errors.slice(-20),
  };
  const md = `# Corpus blitz

SHA: \`${payload.sha}\`
Started: ${payload.startedAt}
Stopped: **${payload.stopReason ?? "running"}** at ${payload.stoppedAt}

| Metric | Before | After |
|---|---:|---:|
| Sources | ${payload.urlsBefore} | **${payload.urlsAfter}** |
| Topics | ${payload.topicsBefore} | **${payload.topicsAfter}** |
| People | ${payload.peopleBefore} | **${payload.peopleAfter}** |
| Claims | ${payload.claimsBefore} | ${payload.claimsAfter} |

Stubs created: ${payload.stubsCreated.length}  
People created: ${payload.peopleCreated.length}  
Duplicates rejected: ${payload.duplicatesRejected}  
Topics attempted / ok: ${payload.attempted} / ${payload.ok}  
Gateway vehicle cost: $${payload.gatewayVehicleCostUsd.toFixed(4)}  
Failed jobs: ${payload.failed.length}
`;
  await mkdir(path.dirname(REPORT_JSON), { recursive: true });
  await writeFile(REPORT_JSON, JSON.stringify(payload, null, 2));
  await writeFile(REPORT_MD, md);
}

async function ensureTopic(entity: SeedEntity, progress: Progress): Promise<{ id: string; createdStub: boolean }> {
  const existing = await store.getTopicBySlug(entity.slug);
  if (existing) return { id: existing.topic.id, createdStub: false };
  const topic = await store.upsertTopic({
    id: `topic_${entity.slug}`,
    slug: entity.slug,
    name: entity.name,
    entityType: entity.entityType,
    kind: topicKind(entity),
    description: entity.description,
    aliases: entity.aliases ?? [],
    officialDomains: entity.officialDomains ?? [],
    status: "stub",
    lastVerifiedAt: null,
    lastMaterialChangeAt: null,
  });
  progress.stubsCreated.push(entity.slug);
  if (topicKind(entity) === "person") progress.peopleCreated.push(entity.slug);
  return { id: topic.id, createdStub: true };
}

async function main() {
  if (process.env.EXA_API_KEY) {
    throw new Error("EXA_API_KEY is set; ocean:blitz uses gateway.tools.exaSearch() only.");
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
    process.exit(2);
  }
  const progress = await loadProgress();
  progress.stopReason = null;
  if (!exaModelVehicleAllowed()) {
    progress.stopReason = "protect";
    progress.errors.push("EXA_ALLOW_MODEL_VEHICLE is unset.");
    await saveProgress(progress);
    await writeReport(progress);
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

  const vehicle = resolveExaVehicleModel(EXA_VEHICLE_MODEL);
  let sessionSpendUsd = 0;
  await writeLock();
  const graph = await store.getGraph();
  const proposal = proposeFrontier(graph, getFrontierSeedEntities());
  progress.duplicatesRejected += proposal.rejected.filter((row) => row.reason === "duplicate").length;
  await writeEdges(proposal.edges);

  const queue = proposal.accepted.map((row) => row.entity).filter((entity) => !progress.completed.includes(entity.slug));

  log({
    event: "start",
    sha: progress.sha,
    queue: queue.length,
    duplicatesRejected: progress.duplicatesRejected,
    urlsAtStart: progress.urlsAtStart,
    topicsAtStart: progress.topicsAtStart,
    vehicle,
    sessionCeilingUsd: EXA_OCEAN_SESSION_CEILING_USD,
  });

  for (const entity of queue) {
    if (signaled) break;
    const stop = exaOceanStopReason({
      nowMs: Date.now(),
      hardStopMs: HARD_STOP_MS,
      queueRemaining: 1,
      signaled,
    });
    if (stop) {
      progress.stopReason = stop;
      break;
    }
    log({ event: "topic_start", slug: entity.slug, remaining: queue.length - progress.completed.length });
    try {
      const { id, createdStub } = await ensureTopic(entity, progress);
      const result = await discoverSourcesForEntity({
        entity,
        topicId: id,
        pass: 1,
        hardStopMs: HARD_STOP_MS,
      });
      result.createdStub = createdStub;
      progress.results[entity.slug] = result;
      progress.completed.push(entity.slug);
      progress.gatewayVehicleCostUsd += result.gatewayCostUsd;
      sessionSpendUsd += result.gatewayCostUsd;
      progress.errors.push(...result.errors);
      if (result.errors.some((row) => /budget exceeded|quota_for_entity|payment/i.test(row))) {
        progress.stopReason = "quota";
        signaled = true;
      }
      if (sessionSpendUsd >= EXA_OCEAN_SESSION_CEILING_USD) {
        progress.stopReason = "session_cap";
        signaled = true;
      }
      const credits = await readGatewayCredits();
      if (credits.balanceUsd != null && credits.balanceUsd < EXA_CREDIT_FLOOR_USD) {
        progress.stopReason = "quota";
        progress.errors.push(`credit_floor ${credits.balanceUsd} < ${EXA_CREDIT_FLOOR_USD}`);
        signaled = true;
      }
      log({
        event: "topic_ok",
        slug: entity.slug,
        hits: result.hits,
        sourcesAdded: result.sourcesAdded,
        sessionSpendUsd,
        creditBalanceUsd: credits.balanceUsd,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "topic_failed";
      progress.errors.push(`${entity.slug}: ${message}`);
      log({ event: "topic_err", slug: entity.slug, error: message });
    }
    await saveProgress(progress);
    await writeReport(progress);
  }

  if (!progress.stopReason) {
    progress.stopReason = isExaHardStop(Date.now(), HARD_STOP_MS) ? "hard_stop" : "queue";
  }
  await saveProgress(progress);
  await writeReport(progress);
  await releaseLock();
  const after = await store.getGraph();
  log({
    event: "done",
    stopReason: progress.stopReason,
    urls: after.sources.length,
    topics: after.topics.length,
  });
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
