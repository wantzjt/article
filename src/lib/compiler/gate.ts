import type { CandidateClaim } from "./types";

export type GateDecision =
  | { ok: true }
  | { ok: false; reason: string };

const QUOTE = /[“”"']/;

export function gateCandidateClaim(claim: CandidateClaim): GateDecision {
  if (!claim.sourceId?.trim()) {
    return { ok: false, reason: "claim_without_source_id" };
  }
  if (!claim.claimText.trim()) {
    return { ok: false, reason: "empty_claim" };
  }
  if (!claim.evidenceExcerpt.trim()) {
    return { ok: false, reason: "missing_evidence_excerpt" };
  }
  const excerpt = claim.evidenceExcerpt.toLowerCase();
  const text = claim.claimText.toLowerCase();
  for (const number of claim.numbers) {
    const needle = number.replace(/,/g, "").trim();
    if (needle && !excerpt.includes(needle.toLowerCase()) && !text.includes(needle.toLowerCase())) {
      return { ok: false, reason: `unsourced_number:${number}` };
    }
  }
  if (QUOTE.test(claim.claimText) && !QUOTE.test(claim.evidenceExcerpt)) {
    return { ok: false, reason: "invented_quotation" };
  }
  return { ok: true };
}

export function dropClaimsWithoutKnownSource<T extends { source_id: string }>(
  claims: T[],
  sourceIds: Set<string>,
): T[] {
  return claims.filter((claim) => sourceIds.has(claim.source_id));
}

export function excerptSupportsClaim(input: {
  claimText: string;
  excerpt: string;
}): boolean {
  const claimTokens = input.claimText
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 3);
  if (claimTokens.length === 0) return false;
  const excerpt = input.excerpt.toLowerCase();
  const hits = claimTokens.filter((token) => excerpt.includes(token)).length;
  return hits / claimTokens.length >= 0.35;
}
