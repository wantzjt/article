const PUNCT = /[^\p{L}\p{N}\s]+/gu;

export function normalizeClaimText(text: string): string {
  return text
    .toLowerCase()
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function claimsAreExactDuplicates(a: string, b: string): boolean {
  return normalizeClaimText(a) === normalizeClaimText(b);
}
