import { describe, expect, it } from "vitest";
import { resetMemoryForTests, upsertSource, upsertSources, findSourceByUrl, listSources } from "@/lib/store/json-store";
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

  it("batch-upserts by canonical url and content hash", async () => {
    resetMemoryForTests(emptyGraph());
    const row = (id: string, url: string, hash: string) => ({
      id,
      canonicalUrl: url,
      title: id,
      publisher: "openai.com",
      publisherDomain: "openai.com",
      author: null,
      publishedAt: null,
      retrievedAt: "t",
      sourceType: "official" as const,
      primaryStatus: "primary" as const,
      contentHash: hash,
      evidenceExcerpt: "excerpt long enough",
      metadata: {},
    });
    await upsertSources([
      row("a", "https://openai.com/one", "h1"),
      row("b", "https://openai.com/two", "h2"),
    ]);
    await upsertSources([
      row("c", "https://openai.com/one", "h1"),
      row("d", "https://openai.com/two", "h3"),
    ]);
    const sources = await listSources();
    expect(sources).toHaveLength(2);
    expect((await findSourceByUrl("https://openai.com/one"))?.id).toBe("a");
    expect((await findSourceByUrl("https://openai.com/two"))?.contentHash).toBe("h3");
  });
});
