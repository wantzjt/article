/** Public Exa person/company identity. No emails, phones, or private contact fields. */

const PRIVATE_KEY = /^(e[-_]?mails?|phones?|telephones?|mobiles?|fax|ssn)$/i;

export type ExaEntityType = "person" | "company";

export type TopicEntityMeta = {
  exa_entity_id: string;
  exa_type: ExaEntityType;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  location?: string | null;
  workHistory?: unknown[];
  educationHistory?: unknown[];
  foundedYear?: number | null;
  description?: string | null;
  workforce?: unknown;
  headquarters?: unknown;
  financials?: unknown;
  webTraffic?: unknown;
  research?: unknown;
  source_url?: string;
  retrieved_at?: string;
};

export type ExaEntity = {
  id?: string;
  type?: string;
  version?: number;
  properties?: Record<string, unknown>;
};

export function stripPrivateFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrivateFields);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_KEY.test(key)) continue;
    out[key] = stripPrivateFields(child);
  }
  return out;
}

export function pickPrimaryEntity(
  entities: unknown,
  prefer?: ExaEntityType,
): ExaEntity | null {
  if (!Array.isArray(entities)) return null;
  const rows = entities.filter((row): row is ExaEntity => Boolean(row && typeof row === "object"));
  if (prefer) {
    const match = rows.find((row) => row.type === prefer && typeof row.id === "string" && row.id.length > 0);
    if (match) return match;
  }
  return rows.find((row) => typeof row.id === "string" && row.id.length > 0) ?? null;
}

export function topicEntityMetaFromEntity(input: {
  entity: ExaEntity;
  sourceUrl?: string;
  retrievedAt?: string;
}): TopicEntityMeta | null {
  const id = input.entity.id?.trim();
  const type = input.entity.type === "company" || input.entity.type === "person" ? input.entity.type : null;
  if (!id || !type) return null;
  const props = (stripPrivateFields(input.entity.properties ?? {}) ?? {}) as Record<string, unknown>;
  const workHistory = Array.isArray(props.workHistory) ? props.workHistory : undefined;
  const educationHistory = Array.isArray(props.educationHistory) ? props.educationHistory : undefined;
  return {
    exa_entity_id: id,
    exa_type: type,
    name: typeof props.name === "string" ? props.name : null,
    firstName: typeof props.firstName === "string" ? props.firstName : null,
    lastName: typeof props.lastName === "string" ? props.lastName : null,
    location: typeof props.location === "string" ? props.location : null,
    workHistory,
    educationHistory,
    foundedYear: typeof props.foundedYear === "number" ? props.foundedYear : null,
    description: typeof props.description === "string" ? props.description : null,
    workforce: props.workforce ?? null,
    headquarters: props.headquarters ?? null,
    financials: props.financials ?? null,
    webTraffic: props.webTraffic ?? null,
    research: props.research ?? null,
    source_url: input.sourceUrl,
    retrieved_at: input.retrievedAt,
  };
}

function richness(meta: TopicEntityMeta | null | undefined): number {
  if (!meta) return 0;
  return (
    (meta.workHistory?.length ?? 0) * 4 +
    (meta.educationHistory?.length ?? 0) * 2 +
    (meta.foundedYear ? 2 : 0) +
    (meta.location ? 1 : 0) +
    (meta.name ? 1 : 0) +
    (meta.description ? 1 : 0) +
    (meta.workforce ? 1 : 0) +
    (meta.financials ? 2 : 0)
  );
}

export function mergeTopicEntityMeta(
  current: TopicEntityMeta | null | undefined,
  incoming: TopicEntityMeta | null | undefined,
): TopicEntityMeta | null {
  if (!incoming) return current ?? null;
  if (!current) return incoming;
  if (incoming.exa_entity_id === current.exa_entity_id) {
    return richness(incoming) >= richness(current) ? { ...current, ...incoming } : { ...incoming, ...current };
  }
  return richness(incoming) > richness(current) ? incoming : current;
}

export function topicEntityMetaFromHits(
  hits: Array<{ entityMeta?: TopicEntityMeta | null }>,
): TopicEntityMeta | null {
  let best: TopicEntityMeta | null = null;
  for (const hit of hits) {
    best = mergeTopicEntityMeta(best, hit.entityMeta);
  }
  return best;
}
