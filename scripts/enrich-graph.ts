import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { detectClaimChanges, relationshipChange } from "../src/lib/compiler/change-engine";
import { mergeEdges, resolveSeedEdges } from "../src/lib/compiler/graph-edges";
import { promoteWarehouseStatus } from "../src/lib/compiler/promotion";
import { classifyCoordinates } from "../src/lib/frequency/facets";
import { topicKind } from "../src/lib/compiler/taxonomy";
import { yieldSnapshot } from "../src/lib/compiler/yield";
import { topicIdFromSource } from "../src/lib/store/graph";
import * as store from "../src/lib/store/json-store";

const REPORT = path.join(process.cwd(), "artifacts", "graph-yield.json");

async function main() {
  const before = await store.getGraph();
  const beforeYield = yieldSnapshot(before);
  const bySlug = new Map(before.topics.map((topic) => [topic.slug, topic]));
  const seeded = resolveSeedEdges(before.topics);
  const { next: edges, added } = mergeEdges(before.edges ?? [], seeded);
  const relationshipEvents = added.map((edge) => {
    const from = before.topics.find((topic) => topic.id === edge.fromId);
    const to = before.topics.find((topic) => topic.id === edge.toId);
    return relationshipChange({
      topicId: edge.fromId,
      relatedTopicId: edge.toId,
      summary: `${from?.name ?? edge.fromId} ${edge.kind} ${to?.name ?? edge.toId}`,
    });
  });

  const sourceCount = new Map<string, number>();
  const qualityCount = new Map<string, number>();
  for (const source of before.sources) {
    const id = topicIdFromSource(source);
    if (!id) continue;
    sourceCount.set(id, (sourceCount.get(id) ?? 0) + 1);
    if (source.primaryStatus === "primary" || source.sourceType === "official" || source.sourceType === "filing") {
      qualityCount.set(id, (qualityCount.get(id) ?? 0) + 1);
    }
  }
  const edgeCount = new Map<string, number>();
  for (const edge of edges) {
    edgeCount.set(edge.fromId, (edgeCount.get(edge.fromId) ?? 0) + 1);
    edgeCount.set(edge.toId, (edgeCount.get(edge.toId) ?? 0) + 1);
  }
  const claimCount = new Map<string, number>();
  for (const claim of before.claims) {
    if (claim.status === "rejected") continue;
    claimCount.set(claim.topicId, (claimCount.get(claim.topicId) ?? 0) + 1);
    const topic = before.topics.find((row) => row.id === claim.topicId);
    const coords = classifyCoordinates({
      kind: topic ? topicKind(topic) : "company",
      text: `${topic?.name ?? ""} ${claim.claimText}`,
    });
    claim.coordinates = coords;
  }

  let promoted = 0;
  let demoted = 0;
  for (const topic of before.topics) {
    const next = promoteWarehouseStatus({
      current: topic.status,
      sourceCount: sourceCount.get(topic.id) ?? 0,
      qualityCount: qualityCount.get(topic.id) ?? 0,
      edgeCount: edgeCount.get(topic.id) ?? 0,
      claimCount: claimCount.get(topic.id) ?? 0,
    });
    if (next !== topic.status) {
      if (next === "candidate") demoted += 1;
      else promoted += 1;
      topic.status = next;
    }
  }

  const versionChanges = detectClaimChanges({
    topicId: "graph",
    before: [],
    after: [],
  });
  void versionChanges;
  void bySlug;

  const changes = [...(before.changes ?? [])];
  const seen = new Set(changes.map((row) => `${row.topicId}|${row.kind}|${row.claimId ?? ""}|${row.summary}`));
  function pushAll(events: typeof relationshipEvents) {
    for (const event of events) {
      const id = `${event.topicId}|${event.kind}|${event.claimId ?? ""}|${event.summary}`;
      if (seen.has(id)) continue;
      seen.add(id);
      changes.push(event);
    }
  }
  pushAll(relationshipEvents);

  for (const topic of before.topics) {
    const topicClaims = before.claims.filter((claim) => claim.topicId === topic.id);
    const disputed = topicClaims.filter((claim) => claim.status === "disputed");
    for (const claim of disputed) {
      pushAll(
        detectClaimChanges({
          topicId: topic.id,
          before: topicClaims.map((row) =>
            row.id === claim.id ? { ...row, status: "supported" } : row,
          ),
          after: topicClaims,
        }).filter((row) => row.kind === "disputed"),
      );
    }
    const latest = before.versions
      .filter((row) => row.topicId === topic.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (latest && topic.status !== "candidate") {
      pushAll([
        {
          id: `chg_ver_${topic.id}`,
          topicId: topic.id,
          kind: "updated",
          claimId: null,
          relatedTopicId: null,
          summary: latest.changeSummary,
          material: true,
          createdAt: latest.createdAt,
        },
      ]);
    }
  }

  before.edges = edges;
  before.changes = changes;
  await store.replaceGraph(before);
  const after = yieldSnapshot(await store.getGraph());
  const payload = {
    kind: "graph-yield",
    at: new Date().toISOString(),
    before: beforeYield,
    after,
    edgesAdded: added.length,
    promoted,
    demoted,
  };
  await mkdir(path.dirname(REPORT), { recursive: true });
  await writeFile(REPORT, JSON.stringify(payload, null, 2));
  console.info(JSON.stringify(payload));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
