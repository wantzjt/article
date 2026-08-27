import { neighborTopicIds } from "@/lib/compiler/graph-edges";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { topicKind } from "@/lib/compiler/taxonomy";
import { changeLine, lastRetrievedByTopicId, onPulse, sourceCountsByTopicId } from "@/lib/render/topic-view";
import type { GraphSnapshot } from "@/lib/store/graph";
import { topicIdFromSource } from "@/lib/store/graph";
import type { ClassificationMap } from "./classify";
import { classifyCoordinates, classifyFacet } from "./facets";
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

  const latestChange = new Map<string, (typeof graph.changes)[number]>();
  for (const event of graph.changes ?? []) {
    const prev = latestChange.get(event.topicId);
    if (!prev || event.createdAt > prev.createdAt) latestChange.set(event.topicId, event);
  }
  const neighbors = new Map<string, Set<string>>();
  for (const topic of graph.topics) {
    neighbors.set(topic.id, neighborTopicIds(graph.edges ?? [], topic.id));
  }
  const followedNeighbors = new Set<string>();
  if (profile) {
    for (const row of profile.follows) {
      if (row.muted) continue;
      for (const id of neighbors.get(row.topicId) ?? []) followedNeighbors.add(id);
    }
  }

  const rows: FrequencyChange[] = [];
  for (const topic of graph.topics) {
    if (!isPublicTopicStatus(topic.status)) continue;
    const followedTopic = followed.has(topic.id);
    const related = followedNeighbors.has(topic.id) && !followedTopic;
    if (!followedTopic && !related && !onPulse(topic)) continue;
    const kind = topicKind(topic);
    const headline = latestBrief.get(topic.id)?.headline ?? "";
    const changeSummary = latestVersion.get(topic.id)?.changeSummary ?? "";
    const text = `${topic.name} ${kind} ${headline} ${changeSummary} ${topic.description}`;
    const classified = classifications[topic.id] ?? classifyFacet({ kind, text });
    const coords = classifyCoordinates({ kind, text });
    const event = latestChange.get(topic.id);
    const source = sourceByTopic.get(topic.id);
    const relatedSlug = related
      ? graph.topics.find((row) => followed.has(row.id) && (neighbors.get(row.id)?.has(topic.id) ?? false))?.slug ?? null
      : null;
    rows.push({
      topicId: topic.id,
      slug: topic.slug,
      name: topic.name,
      status: topic.status,
      kind,
      lastMaterialChangeAt: event?.createdAt ?? topic.lastMaterialChangeAt,
      lastVerifiedAt: topic.lastVerifiedAt,
      sourceCount: sourceCounts.get(topic.id) ?? 0,
      claimCount: claimCounts.get(topic.id) ?? 0,
      disputed: disputed.has(topic.id) || event?.kind === "disputed",
      hasBrief: latestBrief.has(topic.id),
      headline: event?.summary || headline,
      changeSummary: event?.summary || changeSummary,
      facet: coords[0]?.facet ?? classified.facet,
      facetChild: coords.find((row) => row.child)?.child ?? classified.child,
      sourceUrl: source?.url ?? null,
      sourceDomain: source?.domain ?? null,
      changeKind: event?.kind ?? (related ? "relationship" : null),
      relatedSlug,
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
