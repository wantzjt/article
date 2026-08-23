import type { CandidateClaim, ClaimRecord, ClaimStatus } from "./types";
import { claimsAreExactDuplicates, normalizeClaimText } from "./normalize";

export function mergeDuplicateClaims(claims: CandidateClaim[]): CandidateClaim[] {
  const merged: CandidateClaim[] = [];
  for (const claim of claims) {
    const existing = merged.find((row) =>
      claimsAreExactDuplicates(row.claimText, claim.claimText),
    );
    if (!existing) {
      merged.push({ ...claim });
      continue;
    }
    if (existing.sourceId !== claim.sourceId) {
      existing.evidenceExcerpt = `${existing.evidenceExcerpt}\n---\n${claim.evidenceExcerpt}`;
    }
  }
  return merged;
}

export function statusFromEvidence(input: {
  supportingDomains: number;
  disputingDomains: number;
}): ClaimStatus {
  if (input.disputingDomains > 0 && input.supportingDomains > 0) return "disputed";
  if (input.supportingDomains >= 2) return "supported";
  if (input.supportingDomains === 1) return "single_source";
  if (input.disputingDomains > 0) return "unresolved";
  return "rejected";
}

export function findMatchingClaim(
  claimText: string,
  existing: ClaimRecord[],
): ClaimRecord | undefined {
  const normalized = normalizeClaimText(claimText);
  return existing.find((claim) => claim.normalizedClaim === normalized);
}
