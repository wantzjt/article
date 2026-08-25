import { describe, expect, it } from "vitest";
import { TOPIC_KINDS } from "@/lib/compiler/types";
import {
  categoryForbidsDateFilter,
  contentTypeForPass,
  exaOceanPasses,
  exaToolArgsForPass,
  topicKind,
  topicKindFromEntityType,
  toExaApiCategory,
} from "@/lib/compiler/taxonomy";
import { discoveredToSourceRecords } from "@/lib/compiler/exa-ocean";
import { SEED_ENTITIES } from "@/lib/seed/entities";
import { getOceanEntityBySlug } from "@/lib/seed/broad";
import { emptyGraph } from "@/lib/store/graph";
import { findSourceByUrl, resetMemoryForTests, upsertSources } from "@/lib/store/json-store";

describe("topic kind map", () => {
  it("covers the product enum and maps legacy entityType", () => {
    expect(TOPIC_KINDS).toEqual([
      "company",
      "product",
      "model",
      "person",
      "policy",
      "standard",
      "event",
      "concept",
    ]);
    expect(topicKindFromEntityType("lab")).toBe("company");
    expect(topicKindFromEntityType("infra")).toBe("product");
    expect(topicKindFromEntityType("model")).toBe("model");
    expect(topicKindFromEntityType("research")).toBe("concept");
    expect(topicKindFromEntityType("round_event")).toBe("event");
    const glm = SEED_ENTITIES.find((row) => row.slug === "glm-5-3");
    expect(topicKind(glm!)).toBe("model");
    expect(topicKind(getOceanEntityBySlug("iso-42001")!)).toBe("standard");
  });
});

describe("taxonomy-aware Exa passes", () => {
  it("fans company seeds across company + news + financial report and omits dates on company/people", () => {
    const openai = SEED_ENTITIES.find((row) => row.slug === "openai")!;
    const passes = exaOceanPasses(openai);
    const cats = new Set(passes.map((pass) => pass.category));
    expect(cats.has("company")).toBe(true);
    expect(cats.has("news")).toBe(true);
    expect(cats.has("financial_report")).toBe(true);
    expect(toExaApiCategory("publication")).toBe("research paper");
    for (const pass of passes.filter((row) => row.category === "company" || row.category === "people")) {
      const args = exaToolArgsForPass(pass, "2025-01-01T00:00:00.000Z");
      expect(args.startPublishedDate).toBeUndefined();
      expect(categoryForbidsDateFilter(pass.category)).toBe(true);
    }
    const newsArgs = exaToolArgsForPass(
      passes.find((row) => row.category === "news")!,
      "2025-01-01T00:00:00.000Z",
    );
    expect(newsArgs.startPublishedDate).toBe("2025-01-01T00:00:00.000Z");
    expect(newsArgs.category).toBe("news");
  });

  it("uses publication + news + web for models and policy", () => {
    const model = SEED_ENTITIES.find((row) => row.slug === "glm-5-3")!;
    const modelCats = new Set(exaOceanPasses(model).map((pass) => pass.category));
    expect(modelCats.has("news")).toBe(true);
    expect(modelCats.has("publication")).toBe(true);
    expect(modelCats.has("web")).toBe(true);
    const policy = SEED_ENTITIES.find((row) => row.slug === "eu-ai-act")!;
    const policyCats = new Set(exaOceanPasses(policy).map((pass) => pass.category));
    expect(policyCats.has("news")).toBe(true);
    expect(policyCats.has("publication")).toBe(true);
  });

  it("persists exa_category and topic_id on sources", async () => {
    resetMemoryForTests(emptyGraph());
    const entity = SEED_ENTITIES.find((row) => row.slug === "openai")!;
    const mapped = discoveredToSourceRecords({
      hits: [
        {
          url: "https://openai.com/index/tax",
          canonicalUrl: "https://openai.com/index/tax",
          title: "tax",
          publisherDomain: "openai.com",
          author: null,
          publishedAt: "2026-01-01T00:00:00.000Z",
          highlights: ["excerpt for taxonomy"],
          query: "OpenAI",
          exaCategory: "company",
          queryTag: "company.canonical",
        },
      ],
      entity,
      topicId: "topic_openai",
      existingByUrl: new Map(),
    });
    await upsertSources(mapped.pending);
    const row = await findSourceByUrl("https://openai.com/index/tax");
    expect(row?.metadata.exa_category).toBe("company");
    expect(row?.metadata.topic_id).toBe("topic_openai");
    expect(row?.metadata.query_tag).toBe("company.canonical");
    expect(row?.metadata.content_type).toBe(contentTypeForPass("company", "official"));
  });
});
