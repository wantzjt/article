import { describe, expect, it } from "vitest";
import { detectClaimChanges } from "@/lib/compiler/change-engine";
import { promoteWarehouseStatus } from "@/lib/compiler/promotion";
import { classifyCoordinates } from "@/lib/frequency/facets";
import { warehouseYieldLow } from "@/lib/compiler/compile-chunk";
import type { ClaimRecord } from "@/lib/compiler/types";

function claim(partial: Partial<ClaimRecord> & Pick<ClaimRecord, "id" | "status" | "claimText">): ClaimRecord {
  return {
    topicId: "topic_nvidia",
    normalizedClaim: partial.claimText.toLowerCase(),
    firstSeenAt: "t",
    lastVerifiedAt: "t",
    supersededAt: null,
    createdAt: "t",
    updatedAt: "t",
    ...partial,
  };
}

describe("change engine", () => {
  it("names new, confirmed, disputed, resolved, and retracted transitions", () => {
    const before = [
      claim({ id: "a", status: "single_source", claimText: "NVIDIA shipped Blackwell." }),
      claim({ id: "b", status: "supported", claimText: "Jensen remains CEO." }),
      claim({ id: "c", status: "disputed", claimText: "Export licenses are paused." }),
    ];
    const after = [
      claim({ id: "a", status: "supported", claimText: "NVIDIA shipped Blackwell." }),
      claim({ id: "c", status: "supported", claimText: "Export licenses are paused." }),
      claim({ id: "d", status: "supported", claimText: "CoWoS capacity expanded." }),
    ];
    const kinds = detectClaimChanges({ topicId: "topic_nvidia", before, after }).map((row) => row.kind);
    expect(kinds).toContain("confirmed");
    expect(kinds).toContain("resolved");
    expect(kinds).toContain("new");
    expect(kinds).toContain("retracted");
  });
});

describe("promotion and yield", () => {
  it("keeps empty discoveries internal", () => {
    expect(
      promoteWarehouseStatus({
        current: "candidate",
        sourceCount: 0,
        qualityCount: 0,
        edgeCount: 0,
        claimCount: 0,
      }),
    ).toBe("candidate");
    expect(
      promoteWarehouseStatus({
        current: "candidate",
        sourceCount: 12,
        qualityCount: 0,
        edgeCount: 0,
        claimCount: 0,
      }),
    ).toBe("stub");
    expect(warehouseYieldLow(0, 25)).toBe(true);
    expect(warehouseYieldLow(10, 10)).toBe(false);
    expect(warehouseYieldLow(7, 186)).toBe(true);
  });
});

describe("multi-facet coordinates", () => {
  it("can tag a claim as GPUs and export controls at once", () => {
    const coords = classifyCoordinates({
      kind: "company",
      text: "NVIDIA Blackwell GPU export controls to China",
    });
    expect(coords.some((row) => row.child === "gpus")).toBe(true);
    expect(coords.some((row) => row.child === "export-controls" || row.child === "china")).toBe(true);
  });
});
