import { randomUUID } from "node:crypto";
import type { ChangeEvent, ChangeKind, ClaimRecord, ClaimStatus } from "./types";

const PUBLIC: ClaimStatus[] = ["supported", "single_source", "disputed"];

function publicSet(claims: ClaimRecord[]): Map<string, ClaimRecord> {
  return new Map(claims.filter((claim) => PUBLIC.includes(claim.status) && !claim.supersededAt).map((claim) => [claim.id, claim]));
}

export function changeKindLabel(kind: ChangeKind): string {
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
    case "retracted":
      return "RETRACTED";
  }
}

/**
 * Deterministic claim-state transitions. No LLM.
 * Mute-the-world: this only names what already happened in persisted claims.
 */
export function detectClaimChanges(input: {
  topicId: string;
  before: ClaimRecord[];
  after: ClaimRecord[];
  now?: Date;
}): ChangeEvent[] {
  const now = (input.now ?? new Date()).toISOString();
  const prev = publicSet(input.before);
  const next = publicSet(input.after);
  const events: ChangeEvent[] = [];

  function push(kind: ChangeKind, claim: ClaimRecord | null, summary: string, material = true) {
    events.push({
      id: `chg_${randomUUID()}`,
      topicId: input.topicId,
      kind,
      claimId: claim?.id ?? null,
      relatedTopicId: null,
      summary,
      material,
      createdAt: now,
    });
  }

  for (const claim of next.values()) {
    const prior = prev.get(claim.id) ?? input.before.find((row) => row.id === claim.id);
    if (!prior) {
      push("new", claim, claim.claimText);
      continue;
    }
    if (prior.status === "single_source" && claim.status === "supported") {
      push("confirmed", claim, claim.claimText);
    } else if (prior.status !== "disputed" && claim.status === "disputed") {
      push("disputed", claim, claim.claimText);
    } else if (prior.status === "disputed" && (claim.status === "supported" || claim.status === "single_source")) {
      push("resolved", claim, claim.claimText);
    } else if (prior.normalizedClaim !== claim.normalizedClaim || prior.claimText !== claim.claimText) {
      push("updated", claim, claim.claimText);
    }
  }

  for (const prior of prev.values()) {
    const current = input.after.find((row) => row.id === prior.id);
    if (!current || current.status === "rejected" || current.supersededAt) {
      push("retracted", prior, prior.claimText);
    }
  }

  return events;
}

export function relationshipChange(input: {
  topicId: string;
  relatedTopicId: string;
  summary: string;
  now?: Date;
}): ChangeEvent {
  return {
    id: `chg_${randomUUID()}`,
    topicId: input.topicId,
    kind: "relationship",
    claimId: null,
    relatedTopicId: input.relatedTopicId,
    summary: input.summary,
    material: true,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}
