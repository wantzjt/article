import { describe, expect, it } from "vitest";
import {
  EXTRACT_CHUNK_SIZE,
  VERIFY_CONCURRENCY,
  chunkList,
  mapPool,
  rankSourcesForExtract,
} from "@/lib/compiler/compile-chunk";
import type { SourceRecord } from "@/lib/compiler/types";

function source(id: string, domain: string, primary: boolean, excerpt: string): SourceRecord {
  return {
    id,
    canonicalUrl: `https://${domain}/${id}`,
    title: id,
    publisher: domain,
    publisherDomain: domain,
    author: null,
    publishedAt: null,
    retrievedAt: "",
    sourceType: primary ? "official" : "reporting",
    primaryStatus: primary ? "primary" : "secondary",
    contentHash: id,
    evidenceExcerpt: excerpt,
    metadata: {},
  };
}

describe("compile chunks", () => {
  it("keeps extract chunks at 10 and official/primary first", () => {
    expect(EXTRACT_CHUNK_SIZE).toBe(10);
    expect(VERIFY_CONCURRENCY).toBe(3);
    const ranked = rankSourcesForExtract(
      [
        source("news", "techcrunch.com", false, "short"),
        source("docs", "openai.com", true, "a longer official excerpt about the lab"),
        source("blog", "openai.com", false, "medium excerpt here"),
      ],
      ["openai.com"],
    );
    expect(ranked.map((row) => row.id)).toEqual(["docs", "blog", "news"]);
    expect(chunkList(ranked, 2)).toHaveLength(2);
  });

  it("runs verify work with bounded concurrency", async () => {
    let live = 0;
    let maxLive = 0;
    const results = await mapPool([1, 2, 3, 4, 5], 3, async (item) => {
      live += 1;
      maxLive = Math.max(maxLive, live);
      await new Promise((resolve) => setTimeout(resolve, 20));
      live -= 1;
      return item * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(maxLive).toBeLessThanOrEqual(3);
  });
});
