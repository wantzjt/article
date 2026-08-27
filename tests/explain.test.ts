import { describe, expect, it } from "vitest";
import { explainWhy, topicEmphasis } from "@/lib/frequency/explain";
import type { RankedChange } from "@/lib/frequency/rank";

function row(partial: Partial<RankedChange>): RankedChange {
  return {
    topicId: "topic_nvidia",
    slug: "nvidia",
    name: "NVIDIA",
    status: "provisional",
    kind: "company",
    lastMaterialChangeAt: "t",
    lastVerifiedAt: "t",
    sourceCount: 10,
    claimCount: 4,
    disputed: false,
    hasBrief: true,
    headline: "Export controls tightened.",
    changeSummary: "Export controls tightened.",
    facet: "regulatory",
    facetChild: "export-controls",
    sourceUrl: null,
    sourceDomain: null,
    changeKind: "updated",
    relatedSlug: null,
    globalSignificance: 0.8,
    personalRelevance: 1,
    score: 0.8,
    followed: true,
    muted: false,
    breakthrough: true,
    reasons: ["followed", "facet regulatory ×1.00", "global 0.80", "breakthrough material"],
    ...partial,
  };
}

describe("why this", () => {
  it("explains follow, facet care, and material interrupt without a formula", () => {
    const text = explainWhy(row({ personalRelevance: 2 }));
    expect(text).toMatch(/You follow NVIDIA/);
    expect(text).toMatch(/Regulation set to More/);
    expect(text).toMatch(/highly material/);
    expect(text).not.toMatch(/0\.\d/);
    expect(text).not.toMatch(/×/);
  });

  it("marks a topic HIGH when any facet is More", () => {
    expect(topicEmphasis({ technology: 2, personnel: -2 }, false)).toBe("HIGH");
    expect(topicEmphasis({ personnel: -2 }, false)).toBe("LOW");
    expect(topicEmphasis({}, false)).toBe("NORMAL");
  });
});
