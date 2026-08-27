import type { TopicEntityMeta } from "./exa-entity";

export type { TopicEntityMeta } from "./exa-entity";

export const ENTITY_TYPES = [
  "lab",
  "model",
  "infra",
  "research",
  "policy",
  "company",
  "investor",
  "round_event",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Product taxonomy. Maps from entityType; do not confuse with Exa search categories. */
export const TOPIC_KINDS = [
  "company",
  "product",
  "model",
  "person",
  "policy",
  "standard",
  "event",
  "concept",
] as const;
export type TopicKind = (typeof TOPIC_KINDS)[number];

export const FINANCE_CLAIM_KINDS = [
  "raised_amount",
  "lead_investor",
  "round_stage",
  "filing_type",
  "reported_valuation",
] as const;
export type FinanceClaimKind = (typeof FINANCE_CLAIM_KINDS)[number];

export const TOPIC_STATUSES = ["candidate", "stub", "provisional", "strong"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const CHANGE_KINDS = [
  "new",
  "updated",
  "confirmed",
  "disputed",
  "resolved",
  "relationship",
  "invalidated",
  "retracted",
] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

export const EDGE_KINDS = [
  "PRODUCT_OF",
  "CEO_OF",
  "DEPENDS_ON",
  "REGULATES",
  "COMPETES_WITH",
  "PART_OF",
  "MENTIONS",
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export type GraphEdge = {
  id: string;
  fromId: string;
  toId: string;
  kind: EdgeKind;
  sourceId: string | null;
  evidence: string;
  createdAt: string;
};

export type ChangeEvent = {
  id: string;
  topicId: string;
  kind: ChangeKind;
  claimId: string | null;
  relatedTopicId: string | null;
  summary: string;
  material: boolean;
  createdAt: string;
  /** All Topics this Change touches. */
  topicIds?: string[];
  sourceIds?: string[];
  facets?: FacetCoordinate[];
  priorStatus?: string | null;
};

export type FacetCoordinate = {
  facet: string;
  child: string | null;
};

export const CLAIM_STATUSES = [
  "supported",
  "single_source",
  "disputed",
  "unresolved",
  "superseded",
  "rejected",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const SUPPORT_TYPES = ["supports", "disputes", "contextualizes"] as const;
export type SupportType = (typeof SUPPORT_TYPES)[number];

export const SOURCE_TYPES = [
  "official",
  "docs",
  "github",
  "arxiv",
  "filing",
  "transcript",
  "reporting",
  "unknown",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const PRIMARY_STATUSES = ["primary", "secondary", "unknown"] as const;
export type PrimaryStatus = (typeof PRIMARY_STATUSES)[number];

export type SeedEntity = {
  slug: string;
  name: string;
  entityType: EntityType;
  description: string;
  aliases: string[];
  officialDomains: string[];
  launchDemo?: boolean;
  /** Product taxonomy; derived from entityType when omitted. */
  kind?: TopicKind;
};

export type SourceRecord = {
  id: string;
  canonicalUrl: string;
  title: string;
  publisher: string;
  publisherDomain: string;
  author: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  sourceType: SourceType;
  primaryStatus: PrimaryStatus;
  contentHash: string;
  evidenceExcerpt: string;
  metadata: Record<string, unknown>;
};

export type ClaimRecord = {
  id: string;
  topicId: string;
  claimText: string;
  normalizedClaim: string;
  status: ClaimStatus;
  firstSeenAt: string;
  lastVerifiedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
  coordinates?: FacetCoordinate[];
};

export type ClaimSourceRecord = {
  claimId: string;
  sourceId: string;
  supportType: SupportType;
  evidenceExcerpt: string;
  createdAt: string;
};

export type TopicRecord = {
  id: string;
  slug: string;
  name: string;
  entityType: EntityType;
  description: string;
  aliases: string[];
  officialDomains: string[];
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
  lastMaterialChangeAt: string | null;
  /** Product kind; derived from entityType when omitted. */
  kind?: TopicKind;
  /** Public Exa person/company identity. Never private contact fields. */
  entityMeta?: TopicEntityMeta | null;
};

export type BriefRecord = {
  id: string;
  topicId: string;
  slug: string;
  headline: string;
  summary: string;
  windowStart: string;
  windowEnd: string;
  publishedAt: string;
  status: "draft" | "published" | "rejected";
  renderData: { claimIds: string[] };
};

export type TopicVersionRecord = {
  id: string;
  topicId: string;
  createdAt: string;
  materialHash: string;
  claimSnapshot: unknown;
  changeSummary: string;
};

export type PipelineStage =
  | "discover"
  | "cluster"
  | "extract"
  | "verify"
  | "render";

export type CandidateClaim = {
  claimText: string;
  sourceId: string;
  evidenceExcerpt: string;
  dates: string[];
  numbers: string[];
  entities: string[];
  financeKind?: FinanceClaimKind | null;
};
