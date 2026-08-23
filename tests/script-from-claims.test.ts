import { describe, expect, it } from "vitest";
import { scriptFromClaims } from "@/lib/audio/scriptFromClaims";
import { glm53Fixture } from "@/lib/fixture/glm-5-3";

describe("scriptFromClaims", () => {
  it("speaks only accepted and disputed claims", () => {
    const script = scriptFromClaims({
      topicName: "GLM-5.3",
      claims: [
        { id: "a", claimText: "GLM-5.3 has a 1M context window.", status: "supported" },
        { id: "b", claimText: "Invented pricing is $400.", status: "rejected" },
      ],
    });
    expect(script.text).toContain("1M context window");
    expect(script.text).not.toContain("$400");
    expect(script.claimIds).toEqual(["a"]);
  });

  it("marks disputed claims as conflict, not a blended fact", () => {
    const script = scriptFromClaims({
      topicName: "GLM-5.3",
      whatChangedIds: ["d"],
      claims: [
        {
          id: "d",
          claimText: "Thinking cannot be disabled.",
          status: "disputed",
        },
      ],
    });
    expect(script.text).toContain("conflict");
    expect(script.text).toContain("do not agree");
    expect(script.text.toLowerCase()).not.toContain("confidence");
  });

  it("builds a non-empty script from the GLM-5.3 fixture", () => {
    const script = scriptFromClaims({
      topicName: "GLM-5.3",
      whatChangedIds: glm53Fixture.briefs[0]?.renderData.claimIds,
      claims: glm53Fixture.claims,
    });
    expect(script.characterCount).toBeGreaterThan(40);
    expect(script.claimIds.length).toBeGreaterThan(0);
    expect(script.text.startsWith("This is GLM-5.3.")).toBe(true);
  });
});
