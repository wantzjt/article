import { describe, expect, it } from "vitest";
import { gateCandidateClaim, excerptSupportsClaim } from "@/lib/compiler/gate";

describe("claim gate", () => {
  it("rejects a claim without a source id", () => {
    const decision = gateCandidateClaim({
      claimText: "GLM-5.3 launched in 2026",
      sourceId: "",
      evidenceExcerpt: "GLM-5.3 launched in 2026",
      dates: ["2026"],
      numbers: [],
      entities: [],
    });
    expect(decision.ok).toBe(false);
  });

  it("rejects invented quotations", () => {
    const decision = gateCandidateClaim({
      claimText: 'The CEO said "we win"',
      sourceId: "src",
      evidenceExcerpt: "The company announced a model.",
      dates: [],
      numbers: [],
      entities: [],
    });
    expect(decision.ok).toBe(false);
  });

  it("accepts excerpt-backed claims", () => {
    const decision = gateCandidateClaim({
      claimText: "AI Gateway exposes GLM-5.3 as zai/glm-5.3",
      sourceId: "src",
      evidenceExcerpt: "AI Gateway exposes Z.ai GLM-5.3 at model id zai/glm-5.3.",
      dates: [],
      numbers: [],
      entities: ["GLM-5.3"],
    });
    expect(decision.ok).toBe(true);
  });

  it("requires excerpt overlap", () => {
    expect(
      excerptSupportsClaim({
        claimText: "The model has a one million token context window",
        excerpt: "flagship model with a 1M-token context window",
      }),
    ).toBe(true);
    expect(
      excerptSupportsClaim({
        claimText: "Pricing is $400 per million tokens",
        excerpt: "The model supports tool calling.",
      }),
    ).toBe(false);
  });
});
