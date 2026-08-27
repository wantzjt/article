import { topicKind } from "@/lib/compiler/taxonomy";
import { changeLine, lastRetrievedByTopicId, onPulse, sourceCountsByTopicId } from "@/lib/render/topic-view";
import type { GraphSnapshot } from "@/lib/store/graph";
import { topicIdFromSource } from "@/lib/store/graph";
import type { ClassificationMap } from "./classify";
import { classifyFacet } from "./facets";
import type { FrequencyChange, FrequencyProfile } from "./rank";

export function changesFromGraph(
  graph: GraphSnapshot,
  profile: FrequencyProfile | null,
  classifications: ClassificationMap = {},
): FrequencyChange[] {
  const followed = new Set(profile?.follows.map((row) => row.topicId) ?? []);
  const sourceCounts = sourceCountsByTopicId(graph.sources);
  const latestSource = lastRetrievedByTopicId(graph.sources);
  const sourceByTopic = new Map<string, { url: string; domain: string }>();
  for (const source of graph.sources) {
    const topicId = topicIdFromSource(source);
    if (!topicId) continue;
    if (latestSource.get(topicId) === source.retrievedAt) {
      sourceByTopic.set(topicId, { url: source.canonicalUrl, domain: source.publisherDomain });
    }
  }
  const claimCounts = new Map<string, number>();
  const disputed = new Set<string>();
  for (const claim of graph.claims) {
    if (claim.status === "rejected") continue;
    claimCounts.set(claim.topicId, (claimCounts.get(claim.topicId) ?? 0) + 1);
    if (claim.status === "disputed") disputed.add(claim.topicId);
  }
  const latestVersion = new Map<string, { createdAt: string; changeSummary: string }>();
  for (const version of graph.versions) {
    const prev = latestVersion.get(version.topicId);
    if (!prev || version.createdAt > prev.createdAt) {
      latestVersion.set(version.topicId, {
        createdAt: version.createdAt,
        changeSummary: version.changeSummary,
      });
    }
  }
  const latestBrief = new Map<string, { publishedAt: string; headline: string }>();
  for (const brief of graph.briefs) {
    if (brief.status !== "published") continue;
    const prev = latestBrief.get(brief.topicId);
    if (!prev || brief.publishedAt > prev.publishedAt) {
      latestBrief.set(brief.topicId, { publishedAt: brief.publishedAt, headline: brief.headline });
    }
  }

  const rows: FrequencyChange[] = [];
  for (const topic of graph.topics) {
    const followedTopic = followed.has(topic.id);
    if (!followedTopic && !onPulse(topic)) continue;
    const kind = topicKind(topic);
    const headline = latestBrief.get(topic.id)?.headline ?? "";
    const changeSummary = latestVersion.get(topic.id)?.changeSummary ?? "";
    const text = `${topic.name} ${kind} ${headline} ${changeSummary} ${topic.description}`;
    const classified = classifications[topic.id] ?? classifyFacet({ kind, text });
    const source = sourceByTopic.get(topic.id);
    rows.push({
      topicId: topic.id,
      slug: topic.slug,
      name: topic.name,
      status: topic.status,
      kind,
      lastMaterialChangeAt: topic.lastMaterialChangeAt,
      lastVerifiedAt: topic.lastVerifiedAt,
      sourceCount: sourceCounts.get(topic.id) ?? 0,
      claimCount: claimCounts.get(topic.id) ?? 0,
      disputed: disputed.has(topic.id),
      hasBrief: latestBrief.has(topic.id),
      headline,
      changeSummary,
      facet: classified.facet,
      facetChild: classified.child,
      sourceUrl: source?.url ?? null,
      sourceDomain: source?.domain ?? null,
    });
  }
  return rows;
}

export function changeCopy(change: Pick<FrequencyChange, "headline" | "changeSummary">): string {
  return changeLine({
    briefHeadline: change.headline || null,
    changeSummary: change.changeSummary || null,
  });
}
