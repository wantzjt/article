import { describe, expect, it } from "vitest";
import {
  formatNightReportMarkdown,
  inferRunner,
  safeLastError,
  summarizeOcean,
} from "@/lib/compiler/ocean-report";
import { emptyGraph } from "@/lib/store/graph";

describe("ocean summary", () => {
  it("counts statuses, What Moved, and spend without leaking secrets", () => {
    const graph = emptyGraph();
    graph.topics.push(
      {
        id: "t1",
        slug: "openai",
        name: "OpenAI",
        entityType: "lab",
        description: "",
        aliases: [],
        officialDomains: [],
        status: "provisional",
        createdAt: "",
        updatedAt: "",
        lastVerifiedAt: "2026-08-25T03:30:00.000Z",
        lastMaterialChangeAt: "2026-08-25T03:30:00.000Z",
      },
      {
        id: "t2",
        slug: "glm-5-3",
        name: "GLM-5.3",
        entityType: "model",
        description: "",
        aliases: [],
        officialDomains: [],
        status: "strong",
        createdAt: "",
        updatedAt: "",
        lastVerifiedAt: "2026-08-23T19:36:00.000Z",
        lastMaterialChangeAt: "2026-08-23T18:00:00.000Z",
      },
    );
    graph.claims.push({
      id: "c1",
      topicId: "t1",
      claimText: "a claim",
      normalizedClaim: "a claim",
      status: "supported",
      firstSeenAt: "",
      lastVerifiedAt: "",
      supersededAt: null,
      createdAt: "",
      updatedAt: "",
    });
    graph.sources.push({
      id: "s1",
      canonicalUrl: "https://openai.com/x",
      title: "x",
      publisher: "openai.com",
      publisherDomain: "openai.com",
      author: null,
      publishedAt: null,
      retrievedAt: "",
      sourceType: "official",
      primaryStatus: "primary",
      contentHash: "h",
      evidenceExcerpt: "excerpt",
      metadata: {},
    });
    graph.spend.push({
      id: "e1",
      day: new Date().toISOString().slice(0, 10),
      stage: "extract",
      topicId: "t1",
      model: "zai/glm-5.2",
      costUsd: 0.01,
      createdAt: new Date().toISOString(),
    });
    const summary = summarizeOcean(graph);
    expect(summary.urls).toBe(1);
    expect(summary.claims).toBe(1);
    expect(summary.topics).toEqual({ strong: 1, provisional: 1, stub: 0 });
    expect(summary.whatMoved.map((row) => row.slug)).toEqual(["openai", "glm-5-3"]);
    expect(summary.spendTodayUsd).toBeCloseTo(0.01);
    expect(summary.lastError).toBeNull();
    expect(inferRunner(new Date().toISOString())).toBe("night");
    expect(inferRunner("2026-08-01T00:00:00.000Z", new Date("2026-08-25T00:00:00.000Z"))).toBe("idle");
    expect(safeLastError("stage timeout: extract after 120000ms token eyJhbGciOiJIUz.payload.sig")).toBe(
      "stage timeout: extract after 120000ms token [redacted]",
    );
    const md = formatNightReportMarkdown({
      kind: "ocean-night",
      startedAt: "t0",
      stoppedAt: "t1",
      stopReason: "clock",
      stopAt: "t2",
      primaryModel: "zai/glm-5.2",
      spendCeilingUsd: 6.5,
      spendTodayUsd: 0.01,
      urls: 1,
      claims: 1,
      topics: summary.topics,
      whatMoved: summary.whatMoved,
      attempted: ["openai"],
      ok: ["openai"],
      skipped: [],
      failures: [],
      results: {},
    });
    expect(md).toContain("Stopped: **clock**");
    expect(md).not.toContain("DATABASE_URL");
    expect(md).not.toContain("ADMIN_SECRET");
  });
});
