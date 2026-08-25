import { describe, expect, it } from "vitest";
import {
  EXTRACT_CHUNK_SIZE,
  VERIFY_CONCURRENCY,
  cachedSourcesForTopic,
  chunkList,
  mapPool,
  rankSourcesForExtract,
  shouldSkipExtract,
  sourcesReadyForExtract,
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
  it("keeps extract chunks small and official/primary first", () => {
    expect(EXTRACT_CHUNK_SIZE).toBe(5);
    expect(VERIFY_CONCURRENCY).toBe(5);
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

  it("skips extract when claims already exist or hashes are unchanged", () => {
    expect(
      shouldSkipExtract({ acceptedClaimCount: 5, changedSourceCount: 3, strongMinClaims: 5 }),
    ).toBe("enough_claims");
    expect(
      shouldSkipExtract({ acceptedClaimCount: 2, changedSourceCount: 0, strongMinClaims: 5 }),
    ).toBe("unchanged_hash");
    expect(
      shouldSkipExtract({ acceptedClaimCount: 0, changedSourceCount: 0, strongMinClaims: 5 }),
    ).toBeNull();
  });

  it("drops empty excerpts before extract", () => {
    const ready = sourcesReadyForExtract([
      source("empty", "openai.com", true, "   "),
      source("short", "openai.com", true, "too short"),
      source("ok", "openai.com", true, "a substantial excerpt with enough evidence text"),
    ]);
    expect(ready.map((row) => row.id)).toEqual(["ok"]);
  });

  it("does not leak other-topic domains into the compile cache", () => {
    const reused = cachedSourcesForTopic(
      [
        source("oai", "openai.com", true, "openai official excerpt text"),
        source("xai", "x.ai", true, "xai official excerpt text here"),
      ],
      ["x.ai"],
    );
    expect(reused.map((row) => row.id)).toEqual(["xai"]);
  });
});
