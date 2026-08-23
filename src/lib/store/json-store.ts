import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  BriefRecord,
  ClaimRecord,
  ClaimSourceRecord,
  SourceRecord,
  TopicRecord,
  TopicVersionRecord,
} from "@/lib/compiler/types";
import { assembleTopic, emptyGraph, type GraphSnapshot, type PipelineRunRecord, type SpendEvent, type TopicGraph } from "./graph";
import { glm53Fixture } from "@/lib/fixture/glm-5-3";
import { SEED_ENTITIES } from "@/lib/seed/entities";

const DATA_PATH = path.join(process.cwd(), "data", "graph.json");

function mergeSeedStubs(graph: GraphSnapshot): GraphSnapshot {
  const now = "2026-08-23T12:00:00.000Z";
  for (const entity of SEED_ENTITIES) {
    if (graph.topics.some((topic) => topic.slug === entity.slug)) continue;
    graph.topics.push({
      id: `topic_${entity.slug}`,
      slug: entity.slug,
      name: entity.name,
      entityType: entity.entityType,
      description: entity.description,
      aliases: entity.aliases,
      officialDomains: entity.officialDomains,
      status: "stub",
      createdAt: now,
      updatedAt: now,
      lastVerifiedAt: null,
      lastMaterialChangeAt: null,
    });
  }
  return graph;
}

let memory: GraphSnapshot | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<GraphSnapshot> {
  if (memory) return memory;
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    memory = mergeSeedStubs(JSON.parse(raw) as GraphSnapshot);
    return memory;
  } catch {
    memory = mergeSeedStubs(structuredClone(glm53Fixture));
    return memory;
  }
}

async function persist(next: GraphSnapshot): Promise<void> {
  memory = next;
  if (process.env.VITEST) return;
  writeQueue = writeQueue.then(async () => {
    try {
      await mkdir(path.dirname(DATA_PATH), { recursive: true });
      await writeFile(DATA_PATH, JSON.stringify(next, null, 2));
    } catch {
      // Read-only deployments keep the graph in memory for the instance.
    }
  });
  await writeQueue;
}

export async function getGraph(): Promise<GraphSnapshot> {
  return load();
}

export async function replaceGraph(next: GraphSnapshot): Promise<void> {
  await persist(next);
}

export async function listTopics(): Promise<TopicRecord[]> {
  const graph = await load();
  return [...graph.topics].sort((a, b) =>
    (b.lastMaterialChangeAt ?? b.updatedAt).localeCompare(a.lastMaterialChangeAt ?? a.updatedAt),
  );
}

export async function getTopicBySlug(slug: string): Promise<TopicGraph | null> {
  const graph = await load();
  const topic = graph.topics.find((row) => row.slug === slug);
  if (!topic) return null;
  return assembleTopic(graph, topic);
}

export async function getTopicById(id: string): Promise<TopicRecord | null> {
  const graph = await load();
  return graph.topics.find((row) => row.id === id) ?? null;
}

export async function upsertTopic(input: Omit<TopicRecord, "createdAt" | "updatedAt"> & Partial<Pick<TopicRecord, "createdAt" | "updatedAt">>): Promise<TopicRecord> {
  const graph = await load();
  const now = new Date().toISOString();
  const existing = graph.topics.find((row) => row.id === input.id || row.slug === input.slug);
  if (existing) {
    Object.assign(existing, input, { updatedAt: now });
    await persist(graph);
    return existing;
  }
  const row: TopicRecord = {
    ...input,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
  graph.topics.push(row);
  await persist(graph);
  return row;
}

export async function upsertSource(input: SourceRecord): Promise<SourceRecord> {
  const graph = await load();
  const existing = graph.sources.find(
    (row) => row.id === input.id || row.canonicalUrl === input.canonicalUrl,
  );
  if (existing) {
    const id = existing.id;
    Object.assign(existing, input, { id });
    await persist(graph);
    return existing;
  }
  graph.sources.push(input);
  await persist(graph);
  return input;
}

export async function findSourceByUrl(canonicalUrl: string): Promise<SourceRecord | null> {
  const graph = await load();
  return graph.sources.find((row) => row.canonicalUrl === canonicalUrl) ?? null;
}

export async function listClaimsForTopic(topicId: string): Promise<ClaimRecord[]> {
  const graph = await load();
  return graph.claims.filter((claim) => claim.topicId === topicId);
}

export async function upsertClaim(input: ClaimRecord): Promise<ClaimRecord> {
  const graph = await load();
  const existing = graph.claims.find(
    (row) => row.id === input.id || (row.topicId === input.topicId && row.normalizedClaim === input.normalizedClaim && !row.supersededAt),
  );
  if (existing) {
    Object.assign(existing, input, { id: existing.id, firstSeenAt: existing.firstSeenAt });
    await persist(graph);
    return existing;
  }
  graph.claims.push(input);
  await persist(graph);
  return input;
}

export async function attachClaimSource(input: ClaimSourceRecord): Promise<void> {
  const graph = await load();
  const exists = graph.claimSources.some(
    (row) =>
      row.claimId === input.claimId &&
      row.sourceId === input.sourceId &&
      row.supportType === input.supportType,
  );
  if (!exists) graph.claimSources.push(input);
  await persist(graph);
}

export async function listClaimSources(claimIds: string[]): Promise<ClaimSourceRecord[]> {
  const graph = await load();
  const set = new Set(claimIds);
  return graph.claimSources.filter((row) => set.has(row.claimId));
}

export async function addVersion(input: TopicVersionRecord): Promise<void> {
  const graph = await load();
  if (graph.versions.some((row) => row.materialHash === input.materialHash && row.topicId === input.topicId)) {
    return;
  }
  graph.versions.push(input);
  await persist(graph);
}

export async function latestVersion(topicId: string): Promise<TopicVersionRecord | null> {
  const graph = await load();
  return (
    graph.versions
      .filter((row) => row.topicId === topicId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

export async function addBrief(input: BriefRecord): Promise<void> {
  const graph = await load();
  if (graph.briefs.some((row) => row.id === input.id || row.slug === input.slug)) return;
  graph.briefs.push(input);
  await persist(graph);
}

export async function listPublishedBriefs(): Promise<Array<BriefRecord & { topicSlug: string; topicName: string }>> {
  const graph = await load();
  return graph.briefs
    .filter((brief) => brief.status === "published")
    .map((brief) => {
      const topic = graph.topics.find((row) => row.id === brief.topicId);
      return {
        ...brief,
        topicSlug: topic?.slug ?? "",
        topicName: topic?.name ?? "",
      };
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function recordSpend(input: Omit<SpendEvent, "id" | "createdAt" | "day"> & { costUsd: number }): Promise<void> {
  const graph = await load();
  const now = new Date();
  graph.spend.push({
    id: randomUUID(),
    day: now.toISOString().slice(0, 10),
    createdAt: now.toISOString(),
    ...input,
  });
  await persist(graph);
}

export async function modelSpendTodayUsd(): Promise<number> {
  const graph = await load();
  const day = new Date().toISOString().slice(0, 10);
  return graph.spend
    .filter((row) => row.day === day)
    .reduce((sum, row) => sum + row.costUsd, 0);
}

export async function saveRun(input: PipelineRunRecord): Promise<void> {
  const graph = await load();
  const existing = graph.runs.find((row) => row.id === input.id);
  if (existing) Object.assign(existing, input);
  else graph.runs.push(input);
  await persist(graph);
}

export async function getRun(id: string): Promise<PipelineRunRecord | null> {
  const graph = await load();
  return graph.runs.find((row) => row.id === id) ?? null;
}

export function resetMemoryForTests(snapshot: GraphSnapshot = emptyGraph()): void {
  memory = structuredClone(snapshot);
}
