import { describe, expect, it } from "vitest";
import { canonicalizeUrl, isSameCanonicalUrl, publisherDomain } from "@/lib/compiler/urls";

describe("canonicalizeUrl", () => {
  it("strips tracking params, www, hash, and trailing slash", () => {
    expect(
      canonicalizeUrl("HTTPS://WWW.Example.com/path/?utm_source=x&b=2&a=1#frag"),
    ).toBe("https://example.com/path?a=1&b=2");
  });

  it("treats equivalent urls as the same", () => {
    expect(
      isSameCanonicalUrl("https://www.z.ai/blog/glm-5.3/", "https://z.ai/blog/glm-5.3"),
    ).toBe(true);
  });

  it("extracts publisher domain", () => {
    expect(publisherDomain("https://www.vercel.com/changelog/exa")).toBe("vercel.com");
  });
});
