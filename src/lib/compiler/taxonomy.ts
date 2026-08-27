import { TOPIC_KINDS, type EntityType, type SeedEntity, type TopicKind } from "./types";

export type { TopicKind };

/**
 * Article.fm names for Exa indexes. `publication` maps to Exa `research paper`.
 * `web` means uncategorized (no category param).
 */
export const EXA_CATEGORIES = [
  "company",
  "people",
  "publication",
  "news",
  "personal_site",
  "financial_report",
  "web",
] as const;
export type ExaCategory = (typeof EXA_CATEGORIES)[number];

export type ExaApiCategory = "company" | "people" | "research paper" | "news" | "personal site" | "financial report";

const EXA_API_CATEGORY: Record<Exclude<ExaCategory, "web">, ExaApiCategory> = {
  company: "company",
  people: "people",
  publication: "research paper",
  news: "news",
  personal_site: "personal site",
  financial_report: "financial report",
};

export function isTopicKind(value: string | null | undefined): value is TopicKind {
  return Boolean(value && (TOPIC_KINDS as readonly string[]).includes(value));
}

export function isExaCategory(value: string | null | undefined): value is ExaCategory {
  return Boolean(value && (EXA_CATEGORIES as readonly string[]).includes(value));
}

export function topicKindFromEntityType(entityType: EntityType | string): TopicKind {
  switch (entityType) {
    case "lab":
    case "company":
    case "investor":
      return "company";
    case "infra":
      return "product";
    case "model":
      return "model";
    case "policy":
      return "policy";
    case "research":
      return "concept";
    case "round_event":
      return "event";
    default:
      return "concept";
  }
}

export function topicKind(entity: Pick<SeedEntity, "entityType"> & { kind?: TopicKind }): TopicKind {
  return entity.kind ?? topicKindFromEntityType(entity.entityType);
}

export function taxonomyPath(kind: TopicKind, slug: string): string[] {
  return [kind, slug];
}

/** Exa company/people indexes reject date filters and excludeDomains. */
export function categoryForbidsDateFilter(category: ExaCategory | undefined): boolean {
  return category === "company" || category === "people";
}

export function toExaApiCategory(category: ExaCategory | undefined): ExaApiCategory | undefined {
  if (!category || category === "web") return undefined;
  return EXA_API_CATEGORY[category];
}

export type ExaOceanPass = {
  query: string;
  category: ExaCategory;
  queryTag: string;
  includeDomains?: string[];
};

export function exaToolArgsForPass(pass: Pick<ExaOceanPass, "category" | "includeDomains">, startPublishedDate?: string) {
  const forbid = categoryForbidsDateFilter(pass.category);
  return {
    category: toExaApiCategory(pass.category),
    includeDomains: forbid ? undefined : pass.includeDomains,
    startPublishedDate: forbid ? undefined : startPublishedDate,
  };
}

export function contentTypeForPass(category: ExaCategory, sourceType: string): string {
  if (category === "news") return "news";
  if (category === "publication") return "publication";
  if (category === "financial_report") return "filing";
  if (category === "people") return "profile";
  if (category === "personal_site") return "personal";
  if (category === "company") return "company";
  return sourceType;
}

export function exaOceanPasses(entity: SeedEntity): ExaOceanPass[] {
  const kind = topicKind(entity);
  const name = entity.name;
  const aliases = entity.aliases.slice(0, 4).join(" OR ");
  const domain = entity.officialDomains[0];
  const official = entity.officialDomains.length ? entity.officialDomains : undefined;
  const rows: ExaOceanPass[] = [];
  const seen = new Set<string>();

  function add(query: string, category: ExaCategory, queryTag: string, includeDomains?: string[]) {
    const value = query.trim();
    const key = `${category}|${value}|${includeDomains?.join(",") ?? ""}`;
    if (!value || seen.has(key)) return;
    seen.add(key);
    rows.push({ query: value, category, queryTag, includeDomains });
  }

  switch (kind) {
    case "company":
      add(name, "company", "company.canonical");
      if (aliases) add(`${name} ${aliases}`, "company", "company.aliases");
      add(`${name} announces OR releases OR launches OR partnership`, "news", "news.announce");
      add(`${name} funding OR investment OR Form D OR 8-K`, "financial_report", "fin.report");
      if (domain) add(`${name} site:${domain}`, "web", "web.official", official);
      break;
    case "model":
    case "product":
      add(`${name} documentation OR model card OR API OR docs`, "web", "web.docs");
      add(`${name} announces OR releases OR launches`, "news", "news.announce");
      add(`${name} technical report OR paper OR evaluation OR benchmark`, "publication", "pub.tech");
      if (domain) add(`${name} site:${domain}`, "web", "web.official", official);
      break;
    case "person":
      add(name, "people", "people.canonical");
      if (aliases) add(`${name} ${aliases}`, "people", "people.role");
      add(`${name} interview OR appointment OR partner OR CEO`, "news", "news.person");
      break;
    case "policy":
    case "standard":
      add(`${name} regulation OR guidance OR filing OR implementation`, "news", "news.policy");
      add(`${name} official text OR standard OR act OR framework`, "publication", "pub.policy");
      add(name, "web", "web.policy");
      if (domain) add(`${name} site:${domain}`, "web", "web.official", official);
      break;
    case "event":
      add(`${name} announces OR closes OR raised`, "news", "news.event");
      add(`${name} funding OR Form D OR 8-K`, "financial_report", "fin.event");
      add(name, "web", "web.event");
      break;
    default:
      add(`${name} paper OR preprint OR technical report`, "publication", "pub.research");
      add(`${name} announces OR results OR benchmark`, "news", "news.research");
      add(name, "web", "web.research");
      if (domain) add(`${name} site:${domain}`, "web", "web.official", official);
  }
  return rows;
}
