import { describe, expect, it } from "vitest";
import { failClosedStatus, graduateTopic, robotsForStatus, shouldPublishBrief } from "@/lib/compiler/publication";
import type { ClaimRecord, ClaimSourceRecord, SourceRecord } from "@/lib/compiler/types";

function claim(id: string): ClaimRecord {
  return {
    id,
    topicId: "t",
    claimText: id,
    normalizedClaim: id,
    status: "supported",
    firstSeenAt: "",
    lastVerifiedAt: "",
    supersededAt: null,
    createdAt: "",
    updatedAt: "",
  };
}

function source(id: string, domain: string, primary: boolean): SourceRecord {
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
    evidenceExcerpt: "excerpt",
    metadata: {},
  };
}

describe("publication gate", () => {
  it("requires density for strong/indexable topics", () => {
    const claims = [claim("a"), claim("b"), claim("c"), claim("d"), claim("e")];
    const sources = [
      source("1", "z.ai", true),
      source("2", "vercel.com", true),
      source("3", "eve.dev", false),
    ];
    const links: ClaimSourceRecord[] = claims.map((row, index) => ({
      claimId: row.id,
      sourceId: sources[index % sources.length].id,
      supportType: "supports",
      evidenceExcerpt: "excerpt",
      createdAt: "",
    }));
    expect(
      graduateTopic({
        acceptedClaims: claims,
        claimSources: links,
        sources,
        hasWhatChanged: true,
      }),
    ).toBe("strong");
    expect(robotsForStatus("strong")).toBe("index, follow");
    expect(robotsForStatus("stub")).toBe("noindex, follow");
  });

  it("keeps stubs honest", () => {
    expect(
      graduateTopic({
        acceptedClaims: [],
        claimSources: [],
        sources: [],
        hasWhatChanged: false,
      }),
    ).toBe("stub");
  });

  it("requires two changed claims for a brief", () => {
    expect(shouldPublishBrief(1)).toBe(false);
    expect(shouldPublishBrief(2)).toBe(true);
  });

  it("never demotes strong on fail-closed", () => {
    expect(failClosedStatus("strong", "stub")).toBe("strong");
  });
});
