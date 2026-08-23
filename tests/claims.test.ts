import { describe, expect, it } from "vitest";
import { mergeDuplicateClaims, statusFromEvidence } from "@/lib/compiler/claims";
import { detectMaterialChange } from "@/lib/compiler/versions";

describe("claim merge and versions", () => {
  it("merges differently worded exact-normalized duplicates", () => {
    const merged = mergeDuplicateClaims([
      {
        claimText: "GLM-5.3 has a 1M context window.",
        sourceId: "a",
        evidenceExcerpt: "1M-token context window",
        dates: [],
        numbers: ["1M"],
        entities: [],
      },
      {
        claimText: "glm-5.3 has a 1m context window",
        sourceId: "b",
        evidenceExcerpt: "1M token context",
        dates: [],
        numbers: ["1M"],
        entities: [],
      },
    ]);
    expect(merged).toHaveLength(1);
  });

  it("persists disagreement instead of averaging", () => {
    expect(statusFromEvidence({ supportingDomains: 2, disputingDomains: 1 })).toBe("disputed");
  });

  it("only versions on material claim change", () => {
    const claims = [{ id: "1", status: "supported" as const, claimText: "A" }];
    const first = detectMaterialChange({ previousHash: null, claims });
    const same = detectMaterialChange({ previousHash: first.hash, claims });
    const changed = detectMaterialChange({
      previousHash: first.hash,
      claims: [...claims, { id: "2", status: "supported" as const, claimText: "B" }],
    });
    expect(same.changed).toBe(false);
    expect(changed.changed).toBe(true);
  });
});
