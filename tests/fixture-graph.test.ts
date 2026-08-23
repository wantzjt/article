import { describe, expect, it } from "vitest";
import { glm53Fixture } from "@/lib/fixture/glm-5-3";
import { assembleTopic } from "@/lib/store/graph";
import { graduateTopic } from "@/lib/compiler/publication";

describe("offline GLM-5.3 fixture", () => {
  const topic = glm53Fixture.topics[0];
  const graph = assembleTopic(glm53Fixture, topic);

  it("traces every accepted claim to a source excerpt", () => {
    const accepted = graph.claims.filter((claim) => claim.status !== "rejected");
    expect(accepted.length).toBeGreaterThanOrEqual(5);
    for (const claim of accepted) {
      expect(claim.evidence.length).toBeGreaterThan(0);
      for (const item of claim.evidence) {
        expect(item.source.canonicalUrl).toMatch(/^https:\/\//);
        expect(item.evidenceExcerpt.length).toBeGreaterThan(12);
      }
    }
  });

  it("keeps a visible disagreement", () => {
    expect(graph.claims.some((claim) => claim.status === "disputed")).toBe(true);
  });

  it("graduates as a strong topic", () => {
    expect(
      graduateTopic({
        acceptedClaims: graph.claims,
        claimSources: glm53Fixture.claimSources,
        sources: graph.sources,
        hasWhatChanged: true,
      }),
    ).toBe("strong");
  });
});
