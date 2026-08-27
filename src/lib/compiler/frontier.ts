import type { SeedEntity } from "./types";
import type { GraphSnapshot } from "@/lib/store/graph";
import { topicIdFromSource } from "@/lib/store/graph";
import { getFrontierSeedEntities } from "@/lib/seed/frontier";

export type FrontierEdge = {
  from: string;
  to: string;
  kind: "mentions";
  mentions: number;
};

export type FrontierProposal = {
  entity: SeedEntity;
  mentions: number;
  related: string[];
  accepted: boolean;
  reason: string;
};

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "ai",
  "inc",
  "ltd",
  "news",
  "blog",
  "report",
]);

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function blobForSource(source: {
  title?: string | null;
  evidenceExcerpt?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const meta = source.metadata ?? {};
  const raw = meta.raw_entity_meta;
  const rawName =
    raw && typeof raw === "object" && typeof (raw as { name?: unknown }).name === "string"
      ? String((raw as { name: string }).name)
      : "";
  return `${source.title ?? ""} ${source.evidenceExcerpt ?? ""} ${rawName}`;
}

export function knownTopicKeys(graph: GraphSnapshot): Set<string> {
  const keys = new Set<string>();
  for (const topic of graph.topics) {
    keys.add(topic.slug);
    keys.add(topic.name.toLowerCase());
    for (const alias of topic.aliases) keys.add(alias.toLowerCase());
  }
  return keys;
}

function alreadyKnown(entity: SeedEntity, known: Set<string>): boolean {
  if (known.has(entity.slug)) return true;
  if (known.has(entity.name.toLowerCase())) return true;
  return entity.aliases.some((alias) => known.has(alias.toLowerCase()));
}

function mentionCount(blob: string, entity: SeedEntity): number {
  const needles = [entity.name, ...entity.aliases].filter((row) => row.length >= 3);
  let n = 0;
  for (const needle of needles) {
    const pattern = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi");
    n += blob.match(pattern)?.length ?? 0;
  }
  return n;
}

/**
 * Graph-driven crawl frontier. Catalog entities plus repeated names in
 * warehouse titles/excerpts. Does not compile. Does not invent claims.
 */
export function proposeFrontier(graph: GraphSnapshot, extra: SeedEntity[] = []): {
  accepted: FrontierProposal[];
  rejected: FrontierProposal[];
  edges: FrontierEdge[];
} {
  const catalog = [...getFrontierSeedEntities(), ...extra];
  const known = knownTopicKeys(graph);
  const topicById = new Map(graph.topics.map((topic) => [topic.id, topic.slug]));
  const blobs = graph.sources.map((source) => ({
    slug: topicById.get(topicIdFromSource(source) ?? "") ?? "",
    text: blobForSource(source),
  }));
  const combined = blobs.map((row) => row.text).join("\n");

  const accepted: FrontierProposal[] = [];
  const rejected: FrontierProposal[] = [];
  const edges: FrontierEdge[] = [];

  for (const entity of catalog) {
    if (!entity.slug || STOP.has(entity.slug) || entity.slug.length < 3) {
      rejected.push({ entity, mentions: 0, related: [], accepted: false, reason: "invalid_slug" });
      continue;
    }
    const mentions = mentionCount(combined, entity);
    const related = new Set<string>();
    for (const row of blobs) {
      if (!row.slug) continue;
      if (mentionCount(row.text, entity) > 0) related.add(row.slug);
    }
    if (alreadyKnown(entity, known)) {
      rejected.push({
        entity,
        mentions,
        related: [...related],
        accepted: false,
        reason: "duplicate",
      });
      continue;
    }
    accepted.push({
      entity,
      mentions,
      related: [...related].slice(0, 12),
      accepted: true,
      reason: mentions > 0 ? "catalog_mentioned" : "catalog_expansion",
    });
    for (const from of related) {
      edges.push({ from, to: entity.slug, kind: "mentions", mentions });
    }
    known.add(entity.slug);
    known.add(entity.name.toLowerCase());
  }

  return { accepted, rejected, edges };
}
