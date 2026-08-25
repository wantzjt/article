import type { ClaimRecord, ClaimSourceRecord, SourceRecord, TopicStatus } from "./types";

export const STRONG_MIN_CLAIMS = 5;
export const STRONG_MIN_DOMAINS = 3;
export const BRIEF_MIN_CHANGED_CLAIMS = 2;

export function graduateTopic(input: {
  acceptedClaims: ClaimRecord[];
  claimSources: ClaimSourceRecord[];
  sources: SourceRecord[];
  hasWhatChanged: boolean;
}): TopicStatus {
  const accepted = input.acceptedClaims.filter(
    (claim) => claim.status === "supported" || claim.status === "single_source" || claim.status === "disputed",
  );
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const domains = new Set<string>();
  let primary = 0;
  for (const link of input.claimSources) {
    const source = sourceById.get(link.sourceId);
    if (!source) continue;
    if (accepted.some((claim) => claim.id === link.claimId)) {
      domains.add(source.publisherDomain);
      if (source.primaryStatus === "primary") primary += 1;
    }
  }
  if (
    accepted.length >= STRONG_MIN_CLAIMS &&
    domains.size >= STRONG_MIN_DOMAINS &&
    primary >= 1 &&
    input.hasWhatChanged
  ) {
    return "strong";
  }
  if (accepted.length >= 1) return "provisional";
  return "stub";
}

export function robotsForStatus(status: TopicStatus): "index, follow" | "noindex, follow" {
  return status === "strong" ? "index, follow" : "noindex, follow";
}

export function shouldPublishBrief(changedAcceptedClaimCount: number): boolean {
  return changedAcceptedClaimCount >= BRIEF_MIN_CHANGED_CLAIMS;
}

/** Timeouts and empty-source exits must not demote an existing strong topic. */
export function failClosedStatus(current: TopicStatus | undefined, next: TopicStatus): TopicStatus {
  if (current === "strong") return "strong";
  return next;
}
