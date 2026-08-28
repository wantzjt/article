import type { GraphSnapshot } from "@/lib/store/graph";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import type { FrequencyChange, FrequencyProfile } from "./rank";
import { clampFacetWeight } from "./facets";
import {
  INTEREST_TREE,
  interestById,
  type InterestDef,
  type LiveInterestNode,
} from "./interest-tree";

export {
  INTEREST_AREAS,
  INTEREST_TREE,
  areaTitle,
  interestById,
  interestChildren,
  interestIdsFromQuery,
  slugsForSelection,
  type InterestDef,
  type InterestKind,
  type LiveInterestNode,
} from "./interest-tree";

export function areaIdForChange(change: Pick<FrequencyChange, "slug" | "kind" | "facet" | "facetChild">): string {
  const node = INTEREST_TREE.find((row) => row.slug === change.slug || row.slugs.includes(change.slug));
  if (node) {
    let cursor: InterestDef | undefined = node;
    while (cursor?.parent) cursor = interestById(cursor.parent);
    if (cursor?.kind === "area") return cursor.id;
  }
  if (change.facet === "regulatory" || change.kind === "policy") return "policy";
  if (change.facet === "personnel" || change.kind === "person") return "people";
  if (change.facet === "economic") return "markets";
  if (change.facet === "partnerships" || change.kind === "company") return "business";
  if (change.facetChild === "robotics") return "technology";
  return "technology";
}

export function interestWeightForChange(
  profile: Pick<FrequencyProfile, "interests">,
  change: Pick<FrequencyChange, "slug" | "kind" | "facet" | "facetChild">,
): number {
  const interests = profile.interests ?? {};
  let weight = 0;
  const area = areaIdForChange(change);
  if (typeof interests[area] === "number") weight = interests[area];
  for (const node of INTEREST_TREE) {
    if (!node.slugs.includes(change.slug) && node.slug !== change.slug) continue;
    if (typeof interests[node.id] === "number") weight = Math.max(weight, interests[node.id]);
    if (node.parent && typeof interests[node.parent] === "number") {
      weight = weight === 0 ? interests[node.parent] : Math.max(weight, interests[node.parent]);
    }
  }
  return clampFacetWeight(weight);
}

function hoursAgo(iso: string | null, now: Date): number {
  if (!iso) return 24 * 45;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 24 * 45;
  return Math.max(0, (now.getTime() - then) / 3_600_000);
}

function isToday(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === now.toISOString().slice(0, 10);
}

export function liveInterestNodes(graph: GraphSnapshot, now = new Date()): LiveInterestNode[] {
  const publicTopics = graph.topics.filter((topic) => isPublicTopicStatus(topic.status));
  const bySlug = new Map(publicTopics.map((topic) => [topic.slug, topic]));
  const changeCount = new Map<string, number>();
  const windowStart = new Date(now.getTime() - 48 * 3600_000).toISOString();
  for (const event of graph.changes ?? []) {
    if (event.createdAt < windowStart) continue;
    const topic = graph.topics.find((row) => row.id === event.topicId);
    if (!topic) continue;
    changeCount.set(topic.slug, (changeCount.get(topic.slug) ?? 0) + 1);
  }

  function memberSlugs(def: InterestDef): string[] {
    if (def.slug && bySlug.has(def.slug)) return [def.slug];
    const own = def.slugs.filter((slug) => bySlug.has(slug));
    const nested = INTEREST_TREE.filter((row) => row.parent === def.id).flatMap(memberSlugs);
    return [...new Set([...own, ...nested])];
  }

  return INTEREST_TREE.map((def) => {
    const members = memberSlugs(def);
    const present = def.kind === "area" || members.length > 0 || Boolean(def.slug && bySlug.has(def.slug));
    let recency = 0;
    let moving = false;
    let hits = 0;
    for (const slug of members) {
      const topic = bySlug.get(slug);
      if (!topic) continue;
      recency = Math.max(recency, 1 / (1 + hoursAgo(topic.lastMaterialChangeAt, now) / 36));
      if (isToday(topic.lastMaterialChangeAt, now)) moving = true;
      hits += changeCount.get(slug) ?? 0;
    }
    const activity = present
      ? Math.max(0.12, Math.min(1, 0.35 * recency + 0.45 * Math.min(1, hits / 4) + (moving ? 0.2 : 0)))
      : 0;
    return {
      ...def,
      slugs: members,
      present,
      activity,
      moving,
      childIds: INTEREST_TREE.filter((row) => row.parent === def.id).map((row) => row.id),
    };
  });
}

export function newspaperAreaForTopic(input: {
  slug: string;
  kind: string;
  facet?: string | null;
  child?: string | null;
}): string {
  return areaIdForChange({
    slug: input.slug,
    kind: input.kind,
    facet: (input.facet as FrequencyChange["facet"]) ?? "technology",
    facetChild: input.child ?? null,
  });
}
