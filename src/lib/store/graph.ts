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

export function assembleTopic(graph: GraphSnapshot, topic: TopicRecord): TopicGraph {
  const claims = graph.claims.filter((claim) => claim.topicId === topic.id);
  const claimIds = new Set(claims.map((claim) => claim.id));
  const links = graph.claimSources.filter((link) => claimIds.has(link.claimId));
  const sourceIds = new Set(links.map((link) => link.sourceId));
  const sources = graph.sources.filter((source) => sourceIds.has(source.id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
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
