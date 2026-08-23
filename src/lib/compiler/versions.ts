import { materialHash } from "./hash";
import type { ClaimRecord } from "./types";

export function detectMaterialChange(input: {
  previousHash: string | null;
  claims: Array<Pick<ClaimRecord, "id" | "status" | "claimText">>;
}): { changed: boolean; hash: string } {
  const hash = materialHash(input.claims);
  return { changed: hash !== input.previousHash, hash };
}
