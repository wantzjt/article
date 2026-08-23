import type { SeedEntity, TopicRecord } from "./types";
import { normalizeClaimText } from "./normalize";

function tokens(value: string): Set<string> {
  return new Set(normalizeClaimText(value).split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const item of a) if (b.has(item)) inter += 1;
  return inter / new Set([...a, ...b]).size;
}

export function resolveEntity(
  proposed: { name: string; aliases?: string[] },
  existing: Array<Pick<TopicRecord, "id" | "name" | "aliases" | "slug">>,
): { kind: "match"; topicId: string } | { kind: "new" } {
  const names = [proposed.name, ...(proposed.aliases ?? [])].map(normalizeClaimText);
  for (const topic of existing) {
    const pool = [topic.name, topic.slug.replaceAll("-", " "), ...topic.aliases].map(
      normalizeClaimText,
    );
    if (names.some((name) => pool.includes(name))) {
      return { kind: "match", topicId: topic.id };
    }
    const proposedTokens = tokens(proposed.name);
    if (jaccard(proposedTokens, tokens(topic.name)) >= 0.9) {
      return { kind: "match", topicId: topic.id };
    }
  }
  return { kind: "new" };
}

export function assertKnownEntity(
  name: string,
  catalog: SeedEntity[],
): SeedEntity | null {
  const resolved = resolveEntity(
    { name, aliases: [] },
    catalog.map((entity) => ({
      id: entity.slug,
      name: entity.name,
      slug: entity.slug,
      aliases: entity.aliases,
    })),
  );
  if (resolved.kind === "match") {
    return catalog.find((entity) => entity.slug === resolved.topicId) ?? null;
  }
  return (
    catalog.find(
      (entity) =>
        normalizeClaimText(entity.name) === normalizeClaimText(name) ||
        entity.aliases.some((alias) => normalizeClaimText(alias) === normalizeClaimText(name)),
    ) ?? null
  );
}
