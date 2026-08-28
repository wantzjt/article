import type { GraphSnapshot } from "@/lib/store/graph";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { compileBlocked } from "@/lib/compiler/compile-priority";
import { movedToday } from "@/lib/render/topic-view";
import type { FrequencyChange, FrequencyProfile } from "./rank";
import { clampFacetWeight } from "./facets";

export type InterestKind = "area" | "cluster" | "topic";

export type InterestDef = {
  id: string;
  name: string;
  kind: InterestKind;
  parent: string | null;
  /** Real Topic slug when this node is a leaf. */
  slug: string | null;
  /** Member slugs used for activity (clusters/areas). */
  slugs: string[];
};

export type LiveInterestNode = InterestDef & {
  present: boolean;
  activity: number;
  moving: boolean;
  childIds: string[];
};

/** Editorial areas. Not the compiler facet list — mapped onto it. */
export const INTEREST_AREAS: InterestDef[] = [
  { id: "technology", name: "Technology", kind: "area", parent: null, slug: null, slugs: [] },
  { id: "business", name: "Business", kind: "area", parent: null, slug: null, slugs: [] },
  { id: "policy", name: "Policy", kind: "area", parent: null, slug: null, slugs: [] },
  { id: "people", name: "People", kind: "area", parent: null, slug: null, slugs: [] },
  { id: "science", name: "Science", kind: "area", parent: null, slug: null, slugs: [] },
  { id: "culture", name: "Culture", kind: "area", parent: null, slug: null, slugs: [] },
  { id: "markets", name: "Markets", kind: "area", parent: null, slug: null, slugs: [] },
];

const CLUSTERS: InterestDef[] = [
  { id: "ai", name: "AI", kind: "cluster", parent: "technology", slug: null, slugs: [] },
  { id: "robotics", name: "Robotics", kind: "cluster", parent: "technology", slug: "robotics", slugs: ["robotics"] },
  { id: "chips", name: "Chips", kind: "cluster", parent: "technology", slug: null, slugs: [] },
  { id: "software", name: "Software", kind: "cluster", parent: "technology", slug: null, slugs: [] },
  { id: "energy", name: "Energy", kind: "cluster", parent: "technology", slug: null, slugs: [] },
  { id: "labs", name: "Labs", kind: "cluster", parent: "business", slug: null, slugs: [] },
  { id: "cloud", name: "Cloud", kind: "cluster", parent: "business", slug: null, slugs: [] },
  { id: "defense", name: "Defense", kind: "cluster", parent: "business", slug: null, slugs: [] },
  { id: "us-policy", name: "US policy", kind: "cluster", parent: "policy", slug: null, slugs: [] },
  { id: "eu-policy", name: "Europe", kind: "cluster", parent: "policy", slug: null, slugs: [] },
  { id: "export-policy", name: "Export rules", kind: "cluster", parent: "policy", slug: null, slugs: [] },
  { id: "ceos", name: "Operators", kind: "cluster", parent: "people", slug: null, slugs: [] },
  { id: "researchers", name: "Researchers", kind: "cluster", parent: "people", slug: null, slugs: [] },
  { id: "models-science", name: "Frontier science", kind: "cluster", parent: "science", slug: null, slugs: [] },
  { id: "media", name: "Media", kind: "cluster", parent: "culture", slug: null, slugs: [] },
  { id: "capital", name: "Capital", kind: "cluster", parent: "markets", slug: null, slugs: [] },
];

const TOPICS: InterestDef[] = [
  { id: "openai", name: "OpenAI", kind: "topic", parent: "ai", slug: "openai", slugs: ["openai"] },
  { id: "anthropic", name: "Anthropic", kind: "topic", parent: "ai", slug: "anthropic", slugs: ["anthropic"] },
  { id: "nvidia", name: "NVIDIA", kind: "topic", parent: "ai", slug: "nvidia", slugs: ["nvidia"] },
  { id: "models", name: "Models", kind: "cluster", parent: "ai", slug: null, slugs: ["gpt-5", "claude-4", "gemini-3", "grok-4", "glm-5-3", "llama-4"] },
  { id: "agents", name: "Agents", kind: "cluster", parent: "ai", slug: null, slugs: ["claude-code", "openai-codex", "cursor", "crewai"] },
  { id: "infra", name: "Infrastructure", kind: "cluster", parent: "ai", slug: null, slugs: ["coreweave", "groq", "together-ai", "nvidia-nim"] },
  { id: "figure-ai", name: "Figure", kind: "topic", parent: "robotics", slug: "figure-ai", slugs: ["figure-ai"] },
  { id: "unitree", name: "Unitree", kind: "topic", parent: "robotics", slug: "unitree", slugs: ["unitree"] },
  { id: "boston-dynamics", name: "Boston Dynamics", kind: "topic", parent: "robotics", slug: "boston-dynamics", slugs: ["boston-dynamics"] },
  { id: "tesla-optimus", name: "Optimus", kind: "topic", parent: "robotics", slug: "tesla-optimus", slugs: ["tesla-optimus"] },
  { id: "amd", name: "AMD", kind: "topic", parent: "chips", slug: "amd", slugs: ["amd"] },
  { id: "tsmc", name: "TSMC", kind: "topic", parent: "chips", slug: "tsmc", slugs: ["tsmc"] },
  { id: "asml", name: "ASML", kind: "topic", parent: "chips", slug: "asml", slugs: ["asml"] },
  { id: "blackwell", name: "Blackwell", kind: "topic", parent: "chips", slug: "blackwell", slugs: ["blackwell"] },
  { id: "cuda", name: "CUDA", kind: "topic", parent: "chips", slug: "cuda", slugs: ["cuda"] },
  { id: "cursor-sw", name: "Cursor", kind: "topic", parent: "software", slug: "cursor", slugs: ["cursor"] },
  { id: "github-copilot", name: "Copilot", kind: "topic", parent: "software", slug: "github-copilot", slugs: ["github-copilot"] },
  { id: "coreweave", name: "CoreWeave", kind: "topic", parent: "energy", slug: "coreweave", slugs: ["coreweave"] },
  { id: "xai", name: "xAI", kind: "topic", parent: "labs", slug: "xai", slugs: ["xai"] },
  { id: "google-deepmind", name: "DeepMind", kind: "topic", parent: "labs", slug: "google-deepmind", slugs: ["google-deepmind"] },
  { id: "z-ai", name: "Z.ai", kind: "topic", parent: "labs", slug: "z-ai", slugs: ["z-ai"] },
  { id: "microsoft-ai", name: "Microsoft", kind: "topic", parent: "cloud", slug: "microsoft-ai", slugs: ["microsoft-ai"] },
  { id: "amazon-bedrock", name: "Amazon", kind: "topic", parent: "cloud", slug: "amazon-bedrock", slugs: ["amazon-bedrock"] },
  { id: "anduril", name: "Anduril", kind: "topic", parent: "defense", slug: "anduril", slugs: ["anduril"] },
  { id: "palantir", name: "Palantir", kind: "topic", parent: "defense", slug: "palantir", slugs: ["palantir"] },
  { id: "ca-sb-53", name: "California AI bills", kind: "topic", parent: "us-policy", slug: "ca-sb-53", slugs: ["ca-sb-53"] },
  { id: "white-house-ai", name: "US AI policy", kind: "topic", parent: "us-policy", slug: "white-house-ai", slugs: ["white-house-ai"] },
  { id: "eu-ai-act", name: "EU AI Act", kind: "topic", parent: "eu-policy", slug: "eu-ai-act", slugs: ["eu-ai-act"] },
  { id: "bis-export-controls", name: "Export controls", kind: "topic", parent: "export-policy", slug: "bis-export-controls", slugs: ["bis-export-controls"] },
  { id: "sam-altman", name: "Sam Altman", kind: "topic", parent: "ceos", slug: "sam-altman", slugs: ["sam-altman"] },
  { id: "jensen-huang", name: "Jensen Huang", kind: "topic", parent: "ceos", slug: "jensen-huang", slugs: ["jensen-huang"] },
  { id: "dario-amodei", name: "Dario Amodei", kind: "topic", parent: "ceos", slug: "dario-amodei", slugs: ["dario-amodei"] },
  { id: "demis-hassabis", name: "Demis Hassabis", kind: "topic", parent: "researchers", slug: "demis-hassabis", slugs: ["demis-hassabis"] },
  { id: "alphafold", name: "AlphaFold", kind: "topic", parent: "models-science", slug: "alphafold", slugs: ["alphafold"] },
  { id: "runway", name: "Runway", kind: "topic", parent: "media", slug: "runway", slugs: ["runway"] },
  { id: "databricks", name: "Databricks", kind: "topic", parent: "capital", slug: "databricks", slugs: ["databricks"] },
];

export const INTEREST_TREE: InterestDef[] = [...INTEREST_AREAS, ...CLUSTERS, ...TOPICS];

const BY_ID = new Map(INTEREST_TREE.map((row) => [row.id, row]));

export function interestById(id: string): InterestDef | undefined {
  return BY_ID.get(id);
}

export function interestChildren(id: string): InterestDef[] {
  return INTEREST_TREE.filter((row) => row.parent === id);
}

/** Parent tap does not mean follow every child slug. */
export function slugsForSelection(selectedIds: string[]): string[] {
  const slugs = new Set<string>();
  for (const id of selectedIds) {
    const node = BY_ID.get(id);
    if (node?.kind === "topic" && node.slug) slugs.add(node.slug);
  }
  return [...slugs];
}

export function interestIdsFromQuery(raw: string | null | undefined): string[] {
  const known = new Set(INTEREST_TREE.map((row) => row.id));
  return (raw ?? "")
    .split(",")
    .map((row) => row.trim())
    .filter((id) => known.has(id));
}

export function areaIdForChange(change: Pick<FrequencyChange, "slug" | "kind" | "facet" | "facetChild">): string {
  const node = INTEREST_TREE.find((row) => row.slug === change.slug || row.slugs.includes(change.slug));
  if (node) {
    let cursor: InterestDef | undefined = node;
    while (cursor?.parent) cursor = BY_ID.get(cursor.parent);
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

export function liveInterestNodes(graph: GraphSnapshot, now = new Date()): LiveInterestNode[] {
  const publicTopics = graph.topics.filter(
    (topic) => isPublicTopicStatus(topic.status) && !compileBlocked(topic.slug),
  );
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
      if (movedToday(topic.lastMaterialChangeAt, now)) moving = true;
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

export function areaTitle(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}
