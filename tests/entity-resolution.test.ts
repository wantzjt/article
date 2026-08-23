import { describe, expect, it } from "vitest";
import { resolveEntity } from "@/lib/compiler/entity-resolution";

describe("entity resolution", () => {
  const existing = [
    { id: "topic_glm53", name: "GLM-5.3", slug: "glm-5-3", aliases: ["zai/glm-5.3", "GLM 5.3"] },
  ];

  it("matches aliases instead of creating a topic", () => {
    expect(resolveEntity({ name: "zai/glm-5.3" }, existing)).toEqual({
      kind: "match",
      topicId: "topic_glm53",
    });
  });

  it("does not auto-create from an unknown string", () => {
    expect(resolveEntity({ name: "Some random startup" }, existing)).toEqual({ kind: "new" });
  });
});
