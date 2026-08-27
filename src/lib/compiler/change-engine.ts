import { randomUUID } from "node:crypto";
import type {
  ChangeEvent,
  ChangeKind,
  ClaimRecord,
  ClaimSourceRecord,
  ClaimStatus,
  FacetCoordinate,
} from "./types";

const PUBLIC: ClaimStatus[] = ["supported", "single_source", "disputed"];

function publicSet(claims: ClaimRecord[]): Map<string, ClaimRecord> {
  return new Map(claims.filter((claim) => PUBLIC.includes(claim.status) && !claim.supersededAt).map((claim) => [claim.id, claim]));
}

export function changeKindLabel(kind: ChangeKind | string | null | undefined): string {
  switch (kind) {
    case "new":
      return "NEW";
    case "updated":
      return "UPDATED";
    case "confirmed":
      return "CONFIRMED";
    case "disputed":
      return "DISPUTED";
    case "resolved":
      return "RESOLVED";
    case "relationship":
      return "RELATIONSHIP";
    case "invalidated":
    case "retracted":
      return "INVALIDATED";
    default:
      return "";
  }
}

function sourcesFor(claimId: string | null, links: ClaimSourceRecord[]): string[] {
  if (!claimId) return [];
  return [...new Set(links.filter((row) => row.claimId === claimId).map((row) => row.sourceId))];
}

/**
 * Deterministic claim-state transitions. No LLM.
 * A Change is a typed delta over persisted claims/edges, not a rewrite.
 */
export function detectClaimChanges(input: {
  topicId: string;
  before: ClaimRecord[];
  after: ClaimRecord[];
  links?: ClaimSourceRecord[];
  relatedTopicIds?: string[];
  now?: Date;
}): ChangeEvent[] {
  const now = (input.now ?? new Date()).toISOString();
  const prev = publicSet(input.before);
  const next = publicSet(input.after);
  const links = input.links ?? [];
  const topicIds = [input.topicId, ...(input.relatedTopicIds ?? [])];
  const events: ChangeEvent[] = [];

  function push(
    kind: ChangeKind,
    claim: ClaimRecord | null,
    summary: string,
    extra?: { priorStatus?: string | null; material?: boolean },
  ) {
    events.push({
      id: `chg_${randomUUID()}`,
      topicId: input.topicId,
      kind,
      claimId: claim?.id ?? null,
      relatedTopicId: null,
      summary,
      material: extra?.material ?? true,
      createdAt: now,
      topicIds,
      sourceIds: sourcesFor(claim?.id ?? null, links),
      facets: (claim?.coordinates as FacetCoordinate[] | undefined) ?? [],
      priorStatus: extra?.priorStatus ?? null,
    });
  }

  for (const claim of next.values()) {
    const prior = prev.get(claim.id) ?? input.before.find((row) => row.id === claim.id);
    if (!prior) {
      push("new", claim, claim.claimText);
      continue;
    }
    if (prior.status === "single_source" && claim.status === "supported") {
      push("confirmed", claim, claim.claimText, { priorStatus: prior.status });
    } else if (prior.status !== "disputed" && claim.status === "disputed") {
      push("disputed", claim, claim.claimText, { priorStatus: prior.status });
    } else if (prior.status === "disputed" && (claim.status === "supported" || claim.status === "single_source")) {
      push("resolved", claim, claim.claimText, { priorStatus: prior.status });
    } else if (prior.normalizedClaim !== claim.normalizedClaim || prior.claimText !== claim.claimText) {
      push("updated", claim, claim.claimText, { priorStatus: prior.status });
    }
  }

  for (const prior of prev.values()) {
    const current = input.after.find((row) => row.id === prior.id);
    if (!current || current.status === "rejected" || current.supersededAt) {
      push("invalidated", prior, prior.claimText, { priorStatus: prior.status });
    }
  }

  return events;
}

export function latestChangeByTopic(changes: ChangeEvent[]): Map<string, ChangeEvent> {
  const out = new Map<string, ChangeEvent>();
  for (const event of changes) {
    const prev = out.get(event.topicId);
    if (!prev || event.createdAt > prev.createdAt) out.set(event.topicId, event);
  }
  return out;
}

export function relationshipChange(input: {
  topicId: string;
  relatedTopicId: string;
  summary: string;
  now?: Date;
}): ChangeEvent {
  const createdAt = (input.now ?? new Date()).toISOString();
  return {
    id: `chg_${randomUUID()}`,
    topicId: input.topicId,
    kind: "relationship",
    claimId: null,
    relatedTopicId: input.relatedTopicId,
    summary: input.summary,
    material: true,
    createdAt,
    topicIds: [input.topicId, input.relatedTopicId],
    sourceIds: [],
    facets: [],
    priorStatus: null,
  };
}
