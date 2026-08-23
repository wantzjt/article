import { describe, expect, it } from "vitest";
import { resetMemoryForTests, upsertSource, findSourceByUrl } from "@/lib/store/json-store";
import { emptyGraph } from "@/lib/store/graph";

describe("source upsert", () => {
  it("does not duplicate canonical urls", async () => {
    resetMemoryForTests(emptyGraph());
    const source = {
      id: "s1",
      canonicalUrl: "https://z.ai/blog/glm-5.3",
      title: "one",
      publisher: "z.ai",
      publisherDomain: "z.ai",
      author: null,
      publishedAt: null,
      retrievedAt: "t",
      sourceType: "official" as const,
      primaryStatus: "primary" as const,
      contentHash: "h1",
      evidenceExcerpt: "excerpt",
      metadata: {},
    };
    await upsertSource(source);
    await upsertSource({ ...source, id: "s2", title: "two" });
    const found = await findSourceByUrl(source.canonicalUrl);
    expect(found?.id).toBe("s1");
    expect(found?.title).toBe("two");
  });
});
