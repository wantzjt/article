import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function contentHash(parts: Array<string | null | undefined>): string {
  return sha256(parts.map((part) => (part ?? "").trim()).join("\n---\n"));
}

export function materialHash(
  claims: Array<{ id: string; status: string; claimText: string }>,
): string {
  const rows = [...claims]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((claim) => `${claim.id}|${claim.status}|${claim.claimText.trim()}`);
  return sha256(rows.join("\n"));
}
