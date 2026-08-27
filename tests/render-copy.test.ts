import { describe, expect, it } from "vitest";
import {
  changeLine,
  displayDek,
  moreChangesForTopic,
  primaryChangeCopy,
  shortExcerpt,
  splitSentences,
} from "@/lib/render/topic-view";

describe("splitSentences", () => {
  it("does not split on GLM-5.3 version dots", () => {
    const text =
      "GLM-5.3 is served on Vercel AI Gateway at zai/glm-5.3 without a separate Z.ai API key. Single-source reports cover the August 14, 2026 release.";
    expect(splitSentences(text)).toHaveLength(2);
    expect(splitSentences(text)[0]).toContain("zai/glm-5.3");
  });
});

describe("changeLine", () => {
  it("prefers the latest brief headline over a version blob", () => {
    expect(
      changeLine({
        briefHeadline: "GLM-5.3 is on AI Gateway; Eve still boots GLM-5.2",
        changeSummary:
          "Description cites Z.ai's description of GLM-5.3 as a flagship model with a 1M-token context window and 128K maximum output.",
      }),
    ).toBe("GLM-5.3 is on AI Gateway; Eve still boots GLM-5.2");
  });

  it("uses the first sentence of a material-change summary when no brief exists", () => {
    expect(
      changeLine({
        changeSummary: "Z.ai introduced GLM-5.3 with 1M context and tool calling. Gateway listing followed.",
      }),
    ).toBe("Z.ai introduced GLM-5.3 with 1M context and tool calling.");
  });

  it("clips a concatenated claim dump to one line", () => {
    const dump =
      "First cloud provider to deploy NVIDIA H200 Tensor Core GPUs Launched Unified Agentic AI Platform for Continuous Agent Improvement Expanded cloud ecosystem to CoreWeave Cloud by Rescale to support AI and engineering workloads";
    expect(primaryChangeCopy(dump).length).toBeLessThanOrEqual(140);
    expect(primaryChangeCopy(dump)).not.toContain("Expanded cloud");
    expect(
      moreChangesForTopic({
        changeEventCount: 1,
        briefClaimCount: 5,
        summary: dump,
      }),
    ).toBe(4);
  });

  it("never falls back to a topic dek", () => {
    const dek =
      "GLM-5.3 is a Z.ai flagship model described as having a 1M-token context window, 128K maximum output, and native tool calling.";
    expect(changeLine({})).toBe("Material change recorded.");
    expect(changeLine({ briefHeadline: null, changeSummary: null })).not.toContain("described as having");
    expect(changeLine({ briefHeadline: "Gateway lists zai/glm-5.3" })).not.toBe(dek);
  });
});

describe("displayDek", () => {
  it("keeps at most two sentences", () => {
    const dek = displayDek(
      "GLM-5.3 is Z.ai's flagship, served on AI Gateway as zai/glm-5.3. Single-source reports cover the August 14 release. A third sentence should not appear.",
    );
    expect(dek).toContain("flagship");
    expect(dek).toContain("August 14");
    expect(dek).not.toContain("third sentence");
  });

  it("drops the second sentence when the pair is too long for a phone", () => {
    const first =
      "GLM-5.3 is a Z.ai flagship model described as having a 1M-token context window, 128K maximum output, and native tool calling and structured output, and is served on Vercel AI Gateway at zai/glm-5.3 without a separate Z.ai API key.";
    const dek = displayDek(
      `${first} Single-source reports cover its August 14, 2026 release, benchmark comparisons, and a reported two-week delay of open weights following red-team testing.`,
    );
    expect(dek).toBe(first);
    expect(dek.startsWith("GLM-5.3")).toBe(true);
    expect(dek).not.toContain("Single-source reports");
  });
});

describe("shortExcerpt", () => {
  it("returns one short attributed-length sentence", () => {
    const excerpt = shortExcerpt(
      "GLM-5.3 is Z.ai's flagship model with a 1M-token context window, 128K max output, native tool calling, and structured output. It is available via the Z.ai API as glm-5.3.",
    );
    expect(excerpt).toContain("flagship");
    expect(excerpt).not.toContain("available via");
    expect(excerpt.length).toBeLessThanOrEqual(160);
  });
});
