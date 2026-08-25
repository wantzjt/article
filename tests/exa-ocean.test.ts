import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExaOceanQueue,
  discoveredToSourceRecords,
  exaOceanQueries,
  exaOceanStopReason,
  isExaHardStop,
} from "@/lib/compiler/exa-ocean";
import { cachedSourcesForTopic } from "@/lib/compiler/compile-chunk";
import { secondNightDecision } from "@/lib/compiler/fail-closed";
import { getBroadSeedEntities, getOceanEntities } from "@/lib/seed/broad";
import { SEED_ENTITIES } from "@/lib/seed/entities";
import { FINANCE_SEED_SLUGS } from "@/lib/seed/finance";
import type { SourceRecord } from "@/lib/compiler/types";
import { emptyGraph } from "@/lib/store/graph";
import { resetMemoryForTests, upsertSources, listSources, findSourceByUrl } from "@/lib/store/json-store";

function src(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("exa ocean discover-only", () => {
  it("does not import model generate APIs on the discover path", () => {
    const blob = [
      src("scripts/ocean-exa.ts"),
      src("src/lib/compiler/exa-ocean.ts"),
      src("src/lib/gateway/exa-invoke.ts"),
    ].join("\n");
    expect(blob).not.toMatch(/\bgenerateText\b/);
    expect(blob).not.toMatch(/\bgenerateStructured\b/);
    expect(blob).not.toMatch(/\bgenerateWithExaSearch\b/);
    expect(blob).not.toMatch(/\bgenerateObject\b/);
    expect(blob).not.toMatch(/\bstreamText\b/);
    expect(src("src/lib/gateway/exa-invoke.ts")).toMatch(/gateway\.tools\.exaSearch/);
  });

  it("builds complementary queries and keeps glm-5-3 off a demo-last penalty", () => {
    const entity = SEED_ENTITIES.find((row) => row.slug === "openai");
    expect(entity).toBeTruthy();
    const queries = exaOceanQueries(entity!);
    expect(queries.length).toBeGreaterThanOrEqual(5);
    expect(queries.some((q) => q.includes("site:openai.com"))).toBe(true);
    expect(queries.some((q) => /announces|releases/.test(q))).toBe(true);
    const ocean = getOceanEntities();
    expect(ocean.some((row) => row.slug === "glm-5-3")).toBe(true);
    expect(ocean.at(-1)?.slug).not.toBe("glm-5-3");
    expect(ocean.some((row) => row.slug === "unitree")).toBe(true);
    expect(ocean.some((row) => row.slug === "cloudflare")).toBe(true);
    for (const slug of FINANCE_SEED_SLUGS) {
      expect(ocean.some((row) => row.slug === slug)).toBe(false);
    }
    expect(getBroadSeedEntities().length).toBeGreaterThanOrEqual(20);
  });

  it("honors hard stop and double-start lock", () => {
    const hard = Date.parse("2026-08-30T23:59:00-05:00");
    expect(isExaHardStop(hard, hard)).toBe(true);
    expect(isExaHardStop(hard - 1, hard)).toBe(false);
    expect(exaOceanStopReason({ nowMs: hard, hardStopMs: hard, queueRemaining: 9, signaled: false })).toBe(
      "hard_stop",
    );
    expect(exaOceanStopReason({ nowMs: 1, hardStopMs: hard, queueRemaining: 0, signaled: false })).toBe("queue");
    expect(exaOceanStopReason({ nowMs: 1, hardStopMs: hard, queueRemaining: 3, signaled: true })).toBe("signal");
    expect(
      secondNightDecision({ lock: { pid: 1, startedAt: "t" }, currentPid: 2, lockPidAlive: true }),
    ).toBe("refuse");
    expect(
      secondNightDecision({ lock: { pid: 1, startedAt: "t" }, currentPid: 2, lockPidAlive: false }),
    ).toBe("proceed");
  });

  it("upserts sources idempotently by canonical url + content hash", async () => {
    resetMemoryForTests(emptyGraph());
    const entity = {
      slug: "openai",
      name: "OpenAI",
      entityType: "lab" as const,
      description: "x",
      aliases: [],
      officialDomains: ["openai.com"],
    };
    const hits = [
      {
        url: "https://openai.com/index/a",
        canonicalUrl: "https://openai.com/index/a",
        title: "A",
        publisherDomain: "openai.com",
        author: null,
        publishedAt: null,
        highlights: ["excerpt one"],
        query: "OpenAI",
      },
    ];
    const first = discoveredToSourceRecords({
      hits,
      entity,
      topicId: "topic_openai",
      existingByUrl: new Map(),
    });
    expect(first.added).toBe(1);
    await upsertSources(first.pending);
    const existing = await listSources();
    const second = discoveredToSourceRecords({
      hits,
      entity,
      topicId: "topic_openai",
      existingByUrl: new Map(existing.map((row) => [row.canonicalUrl, row])),
    });
    expect(second.added).toBe(0);
    expect(second.unchanged).toBe(1);
    await upsertSources(second.pending);
    expect(await listSources()).toHaveLength(1);
    expect((await findSourceByUrl("https://openai.com/index/a"))?.metadata.topicId).toBe("topic_openai");
  });

  it("does not leak tagged sources across topics", () => {
    const tagged: SourceRecord = {
      id: "nyt",
      canonicalUrl: "https://nytimes.com/openai",
      title: "n",
      publisher: "nytimes.com",
      publisherDomain: "nytimes.com",
      author: null,
      publishedAt: null,
      retrievedAt: "",
      sourceType: "reporting",
      primaryStatus: "secondary",
      contentHash: "h",
      evidenceExcerpt: "excerpt long enough for later compile",
      metadata: { topicId: "topic_openai" },
    };
    const other: SourceRecord = {
      ...tagged,
      id: "other",
      canonicalUrl: "https://nytimes.com/meta",
      metadata: { topicId: "topic_meta-ai" },
    };
    const openai = cachedSourcesForTopic([tagged, other], ["openai.com"], [], "topic_openai");
    expect(openai.map((row) => row.id)).toEqual(["nyt"]);
  });

  it("thin pass orders lowest source counts first", () => {
    expect(
      buildExaOceanQueue({
        slugs: ["b", "a", "c"],
        completed: ["a"],
        sourceCounts: { b: 9, c: 1 },
        thinPass: true,
      }),
    ).toEqual(["c", "b"]);
  });
});
