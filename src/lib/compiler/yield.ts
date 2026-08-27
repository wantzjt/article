import { topicIdFromSource, type GraphSnapshot } from "@/lib/store/graph";
import { isPublicTopicStatus } from "./promotion";

export type YieldSnapshot = {
  sources: number;
  topics: number;
  candidates: number;
  stubs: number;
  provisional: number;
  strong: number;
  claims: number;
  edges: number;
  changes: number;
  attachedSources: number;
  unattachedSources: number;
  claimsPerStrong: number;
  sourcesToClaims: number;
  changesNew: number;
  changesConfirmed: number;
  changesDisputed: number;
  changesResolved: number;
  changesUpdated: number;
  changesRelationship: number;
  changesRetracted: number;
  changesInvalidated: number;
};

export function yieldSnapshot(graph: GraphSnapshot): YieldSnapshot {
  const topics = { candidate: 0, stub: 0, provisional: 0, strong: 0 };
  for (const topic of graph.topics) {
    if (topic.status === "strong") topics.strong += 1;
    else if (topic.status === "provisional") topics.provisional += 1;
    else if (topic.status === "candidate") topics.candidate += 1;
    else topics.stub += 1;
  }
  const known = new Set(graph.topics.map((topic) => topic.id));
  let attached = 0;
  for (const source of graph.sources) {
    const id = topicIdFromSource(source);
    if (id && known.has(id)) attached += 1;
  }
  const claims = graph.claims.filter((claim) => claim.status !== "rejected");
  const counts = {
    new: 0,
    confirmed: 0,
    disputed: 0,
    resolved: 0,
    updated: 0,
    relationship: 0,
    retracted: 0,
    invalidated: 0,
  };
  for (const change of graph.changes ?? []) {
    if (change.kind === "invalidated" || change.kind === "retracted") counts.invalidated += 1;
    else if (change.kind in counts) counts[change.kind as keyof typeof counts] += 1;
  }
  return {
    sources: graph.sources.length,
    topics: graph.topics.length,
    candidates: topics.candidate,
    stubs: topics.stub,
    provisional: topics.provisional,
    strong: topics.strong,
    claims: claims.length,
    edges: graph.edges?.length ?? 0,
    changes: graph.changes?.length ?? 0,
    attachedSources: attached,
    unattachedSources: graph.sources.length - attached,
    claimsPerStrong: topics.strong ? Number((claims.length / topics.strong).toFixed(2)) : 0,
    sourcesToClaims: graph.sources.length ? Number((claims.length / graph.sources.length).toFixed(4)) : 0,
    changesNew: counts.new,
    changesConfirmed: counts.confirmed,
    changesDisputed: counts.disputed,
    changesResolved: counts.resolved,
    changesUpdated: counts.updated,
    changesRelationship: counts.relationship,
    changesRetracted: counts.retracted,
    changesInvalidated: counts.invalidated,
  };
}

export function publicTopicCount(graph: GraphSnapshot): number {
  return graph.topics.filter((topic) => isPublicTopicStatus(topic.status)).length;
}
