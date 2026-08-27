import type {
  BriefRecord,
  ClaimRecord,
  ClaimSourceRecord,
  SourceRecord,
  TopicRecord,
  TopicVersionRecord,
} from "@/lib/compiler/types";

export type SpendEvent = {
  id: string;
  day: string;
  stage: string;
  topicId: string | null;
  model: string;
  costUsd: number;
  createdAt: string;
};

export type PipelineRunRecord = {
  id: string;
  topicId: string;
  status: "running" | "completed" | "failed" | "halted";
  stages: Record<string, "pending" | "done" | "failed">;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GraphSnapshot = {
  topics: TopicRecord[];
  sources: SourceRecord[];
  claims: ClaimRecord[];
  claimSources: ClaimSourceRecord[];
  briefs: BriefRecord[];
  versions: TopicVersionRecord[];
  spend: SpendEvent[];
  runs: PipelineRunRecord[];
};

export function emptyGraph(): GraphSnapshot {
  return {
    topics: [],
    sources: [],
    claims: [],
    claimSources: [],
    briefs: [],
    versions: [],
    spend: [],
    runs: [],
  };
}

export type ClaimWithEvidence = ClaimRecord & {
  evidence: Array<{
    source: SourceRecord;
    supportType: ClaimSourceRecord["supportType"];
    evidenceExcerpt: string;
  }>;
};

export type TopicGraph = {
  topic: TopicRecord;
  claims: ClaimWithEvidence[];
  sources: SourceRecord[];
  versions: TopicVersionRecord[];
  briefs: BriefRecord[];
};

/** Ocean banks hits on metadata.topic_id / topicId, not only claim_sources. */
export function topicIdFromSource(source: SourceRecord): string | null {
  const meta = source.metadata ?? {};
  if (typeof meta.topic_id === "string" && meta.topic_id) return meta.topic_id;
  if (typeof meta.topicId === "string" && meta.topicId) return meta.topicId;
  return null;
}

export function assembleTopic(graph: GraphSnapshot, topic: TopicRecord): TopicGraph {
  const claims = graph.claims.filter((claim) => claim.topicId === topic.id);
  const claimIds = new Set(claims.map((claim) => claim.id));
  const links = graph.claimSources.filter((link) => claimIds.has(link.claimId));
  const linkedIds = new Set(links.map((link) => link.sourceId));
  const sourceById = new Map(graph.sources.map((source) => [source.id, source]));
  const sourcesById = new Map<string, SourceRecord>();
  for (const source of graph.sources) {
    if (linkedIds.has(source.id) || topicIdFromSource(source) === topic.id) {
      sourcesById.set(source.id, source);
    }
  }
  const sources = [...sourcesById.values()].sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt));
  return {
    topic,
    sources,
    versions: graph.versions
      .filter((version) => version.topicId === topic.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    briefs: graph.briefs
      .filter((brief) => brief.topicId === topic.id && brief.status === "published")
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    claims: claims.map((claim) => ({
      ...claim,
      evidence: links
        .filter((link) => link.claimId === claim.id)
        .flatMap((link) => {
          const source = sourceById.get(link.sourceId);
          if (!source) return [];
          return [
            {
              source,
              supportType: link.supportType,
              evidenceExcerpt: link.evidenceExcerpt,
            },
          ];
        }),
    })),
  };
}
