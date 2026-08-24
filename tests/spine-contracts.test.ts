import { describe, expect, it } from "vitest";
import { GET as topicAudioGet } from "@/app/api/topic/[slug]/audio/route";
import { playMeta } from "@/lib/audio/brief";
import { isAudioTopic } from "@/lib/audio/constants";
import { scriptFromClaims } from "@/lib/audio/scriptFromClaims";
import { ingestTopic } from "@/lib/compiler/pipeline";
import { gateCandidateClaim } from "@/lib/compiler/gate";
import { resolveEntity } from "@/lib/compiler/entity-resolution";
import { graduateTopic, robotsForStatus } from "@/lib/compiler/publication";
import { statusFromEvidence } from "@/lib/compiler/claims";
import { canonicalizeUrl, isSameCanonicalUrl } from "@/lib/compiler/urls";
import { glm53Fixture } from "@/lib/fixture/glm-5-3";
import { assembleTopic, emptyGraph } from "@/lib/store/graph";
import {
  findSourceByUrl,
  listClaimsForTopic,
  listSources,
  resetMemoryForTests,
  upsertSource,
} from "@/lib/store/json-store";
import { SEED_ENTITIES } from "@/lib/seed/entities";
import type { ClaimRecord, ClaimSourceRecord, SourceRecord } from "@/lib/compiler/types";

function claim(id: string, status: ClaimRecord["status"] = "supported"): ClaimRecord {
  return {
    id,
    topicId: "t",
    claimText: id,
    normalizedClaim: id,
    status,
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

describe("URL canonicalization / source dedupe", () => {
  it("collapses tracking, www, and trailing slash", () => {
    expect(isSameCanonicalUrl("https://www.z.ai/blog/glm-5.3/?utm_source=x", "https://z.ai/blog/glm-5.3")).toBe(
      true,
    );
    expect(canonicalizeUrl("HTTPS://WWW.z.ai/blog/glm-5.3/#frag")).toBe("https://z.ai/blog/glm-5.3");
  });

  it("does not duplicate a canonical URL on second upsert", async () => {
    resetMemoryForTests(emptyGraph());
    const row = {
      id: "s1",
      canonicalUrl: "https://openai.com/index/gpt",
      title: "one",
      publisher: "openai.com",
      publisherDomain: "openai.com",
      author: null,
      publishedAt: null,
      retrievedAt: "t",
      sourceType: "official" as const,
      primaryStatus: "primary" as const,
      contentHash: "h1",
      evidenceExcerpt: "excerpt long enough",
      metadata: {},
    };
    await upsertSource(row);
    await upsertSource({ ...row, id: "s2", title: "two" });
    expect((await listSources()).length).toBe(1);
    expect((await findSourceByUrl(row.canonicalUrl))?.id).toBe("s1");
  });
});

describe("claim without source rejected", () => {
  it("rejects empty sourceId", () => {
    const decision = gateCandidateClaim({
      claimText: "OpenAI released a model",
      sourceId: "",
      evidenceExcerpt: "OpenAI released a model",
      dates: [],
      numbers: [],
      entities: [],
    });
    expect(decision.ok).toBe(false);
  });
});

describe("double ingest glm-5-3 stays unique (46/32 class)", () => {
  it("fixture sources and accepted claims are unique by URL / normalized text", () => {
    const urls = glm53Fixture.sources.map((row) => row.canonicalUrl);
    expect(new Set(urls).size).toBe(urls.length);
    const accepted = glm53Fixture.claims.filter((row) => row.status !== "rejected");
    const norms = accepted.map((row) => row.normalizedClaim);
    expect(new Set(norms).size).toBe(norms.length);
    expect(glm53Fixture.sources.length).toBeGreaterThanOrEqual(5);
    expect(accepted.length).toBeGreaterThanOrEqual(5);
  });

  it("re-upserting every fixture source does not grow the source or claim set", async () => {
    resetMemoryForTests(structuredClone(glm53Fixture));
    const topicId = glm53Fixture.topics[0].id;
    const sourcesBefore = (await listSources()).length;
    const claimsBefore = (await listClaimsForTopic(topicId)).length;
    for (const row of glm53Fixture.sources) {
      await upsertSource({ ...row, title: `${row.title} (again)` });
    }
    expect((await listSources()).length).toBe(sourcesBefore);
    expect((await listClaimsForTopic(topicId)).length).toBe(claimsBefore);
  });
});

describe("stub topics have no Play / audio_not_available", () => {
  it("isAudioTopic is glm-5-3 only", () => {
    expect(isAudioTopic("glm-5-3")).toBe(true);
    expect(isAudioTopic("openai")).toBe(false);
    expect(isAudioTopic("anthropic")).toBe(false);
  });

  it("playMeta is null on a stub slug", () => {
    const graph = assembleTopic(glm53Fixture, glm53Fixture.topics[0]);
    expect(playMeta(graph)?.slug).toBe("glm-5-3");
    expect(playMeta({ ...graph, topic: { ...graph.topic, slug: "openai", status: "stub" } })).toBeNull();
  });

  it("audio route returns audio_not_available for openai", async () => {
    const response = await topicAudioGet(new Request("http://article.fm/api/topic/openai/audio"), {
      params: Promise.resolve({ slug: "openai" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "audio_not_available" });
  });
});

describe("scriptFromClaims disputed is conflict not average", () => {
  it("speaks conflict language and never confidence", () => {
    const script = scriptFromClaims({
      topicName: "GLM-5.3",
      whatChangedIds: ["d"],
      claims: [{ id: "d", claimText: "Thinking cannot be disabled.", status: "disputed" }],
    });
    expect(script.text).toContain("conflict");
    expect(script.text).toContain("do not agree");
    expect(script.text.toLowerCase()).not.toContain("confidence");
    expect(statusFromEvidence({ supportingDomains: 2, disputingDomains: 1 })).toBe("disputed");
  });
});

describe("publication graduation thresholds", () => {
  it("stays stub with no accepted claims", () => {
    expect(
      graduateTopic({ acceptedClaims: [], claimSources: [], sources: [], hasWhatChanged: false }),
    ).toBe("stub");
    expect(robotsForStatus("stub")).toBe("noindex, follow");
  });

  it("is provisional with one accepted claim", () => {
    const claims = [claim("a")];
    const sources = [source("1", "z.ai", true)];
    const links: ClaimSourceRecord[] = [
      { claimId: "a", sourceId: "1", supportType: "supports", evidenceExcerpt: "e", createdAt: "" },
    ];
    expect(
      graduateTopic({ acceptedClaims: claims, claimSources: links, sources, hasWhatChanged: true }),
    ).toBe("provisional");
  });

  it("needs five claims, three domains, a primary, and a change window for strong", () => {
    const claims = ["a", "b", "c", "d", "e"].map((id) => claim(id));
    const sources = [
      source("1", "z.ai", true),
      source("2", "vercel.com", false),
      source("3", "eve.dev", false),
    ];
    const links: ClaimSourceRecord[] = claims.map((row, index) => ({
      claimId: row.id,
      sourceId: sources[index % sources.length].id,
      supportType: "supports",
      evidenceExcerpt: "e",
      createdAt: "",
    }));
    expect(
      graduateTopic({ acceptedClaims: claims.slice(0, 4), claimSources: links, sources, hasWhatChanged: true }),
    ).not.toBe("strong");
    expect(
      graduateTopic({ acceptedClaims: claims, claimSources: links, sources, hasWhatChanged: false }),
    ).not.toBe("strong");
    expect(
      graduateTopic({ acceptedClaims: claims, claimSources: links, sources, hasWhatChanged: true }),
    ).toBe("strong");
    expect(robotsForStatus("strong")).toBe("index, follow");
  });
});

describe("no auto-create topics from NER", () => {
  it("unknown names stay unmatched; ingest refuses non-seed slugs", async () => {
    expect(resolveEntity({ name: "Some random startup" }, [])).toEqual({ kind: "new" });
    expect(SEED_ENTITIES.some((row) => row.slug === "glm-5-3")).toBe(true);
    await expect(ingestTopic("not-a-seed-topic")).rejects.toThrow(/Unknown seed entity/);
  });
});
