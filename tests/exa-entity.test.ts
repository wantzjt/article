import { describe, expect, it } from "vitest";
import {
  mergeTopicEntityMeta,
  pickPrimaryEntity,
  stripPrivateFields,
  topicEntityMetaFromEntity,
  topicEntityMetaFromHits,
} from "@/lib/compiler/exa-entity";
import { discoveredToSourceRecords } from "@/lib/compiler/exa-ocean";
import { hitsFromExaOutput } from "@/lib/gateway/exa";
import { categoryForbidsDateFilter, exaOceanPasses, exaToolArgsForPass, topicKind } from "@/lib/compiler/taxonomy";
import { getPersonSeedEntities as peopleSeeds } from "@/lib/seed/people";
import { getOceanEntities as oceanEntities } from "@/lib/seed/broad";
import { FINANCE_SEED_SLUGS } from "@/lib/seed/finance";
import { emptyGraph } from "@/lib/store/graph";
import {
  findSourceByUrl,
  getTopicById,
  patchTopicEntityMeta,
  resetMemoryForTests,
  upsertSources,
  upsertTopic,
} from "@/lib/store/json-store";

describe("exa person/company identity", () => {
  it("strips emails and phones from entity properties", () => {
    const cleaned = stripPrivateFields({
      name: "Ann Miura-Ko",
      email: "hidden@example.com",
      phone: "555-0100",
      workHistory: [{ title: "Partner", company: { name: "Floodgate", email: "firm@x.com" } }],
    }) as Record<string, unknown>;
    expect(cleaned.name).toBe("Ann Miura-Ko");
    expect(cleaned.email).toBeUndefined();
    expect(cleaned.phone).toBeUndefined();
    const work = cleaned.workHistory as Array<{ company: Record<string, unknown> }>;
    expect(work[0].company.name).toBe("Floodgate");
    expect(work[0].company.email).toBeUndefined();
  });

  it("maps people hits onto source raw_entity_meta and topic identity", async () => {
    const entity = peopleSeeds().find((row) => row.slug === "ann-miura-ko")!;
    expect(topicKind(entity)).toBe("person");
    const passes = exaOceanPasses(entity);
    expect(passes.some((row) => row.category === "people")).toBe(true);
    expect(passes.some((row) => row.category === "news")).toBe(true);
    for (const pass of passes.filter((row) => row.category === "people")) {
      const args = exaToolArgsForPass(pass, "2025-01-01T00:00:00.000Z");
      expect(args.startPublishedDate).toBeUndefined();
      expect(args.includeDomains).toBeUndefined();
      expect(categoryForbidsDateFilter(pass.category)).toBe(true);
    }

    const hits = hitsFromExaOutput(
      {
        results: [
          {
            title: "Ann Miura-Ko",
            url: "https://www.floodgate.com/team/ann-miura-ko",
            highlights: ["Partner at Floodgate"],
            entities: [
              {
                id: "person_ann",
                type: "person",
                version: 1,
                properties: {
                  name: "Ann Miura-Ko",
                  firstName: "Ann",
                  lastName: "Miura-Ko",
                  location: "Palo Alto, California, United States",
                  email: "do-not-store@floodgate.com",
                  workHistory: [{ title: "Partner", company: { id: "company_floodgate", name: "Floodgate" } }],
                },
              },
            ],
          },
        ],
      },
      "Ann Miura-Ko",
      { exaCategory: "people", queryTag: "people.canonical" },
    );
    expect(hits[0]?.entityMeta?.exa_entity_id).toBe("person_ann");
    expect(hits[0]?.entityMeta?.workHistory).toHaveLength(1);
    expect(JSON.stringify(hits[0]?.entityMeta)).not.toMatch(/do-not-store/);

    resetMemoryForTests(emptyGraph());
    await upsertTopic({
      id: "topic_ann-miura-ko",
      slug: "ann-miura-ko",
      name: entity.name,
      entityType: entity.entityType,
      kind: "person",
      description: entity.description,
      aliases: entity.aliases,
      officialDomains: entity.officialDomains,
      status: "stub",
      lastVerifiedAt: null,
      lastMaterialChangeAt: null,
    });
    const mapped = discoveredToSourceRecords({
      hits,
      entity,
      topicId: "topic_ann-miura-ko",
      existingByUrl: new Map(),
    });
    expect(mapped.entityMeta?.exa_entity_id).toBe("person_ann");
    expect(mapped.pending[0]?.metadata.entity_id).toBe("person_ann");
    expect(mapped.pending[0]?.metadata.exa_category).toBe("people");
    const raw = mapped.pending[0]?.metadata.raw_entity_meta as { properties?: { workHistory?: unknown[] } };
    expect(raw.properties?.workHistory).toHaveLength(1);
    expect(JSON.stringify(mapped.pending[0]?.metadata.raw_entity_meta)).not.toMatch(/do-not-store/);
    await upsertSources(mapped.pending);
    await patchTopicEntityMeta("topic_ann-miura-ko", mapped.entityMeta!);
    const topic = await getTopicById("topic_ann-miura-ko");
    expect(topic?.entityMeta?.name).toBe("Ann Miura-Ko");
    const stored = await findSourceByUrl("https://floodgate.com/team/ann-miura-ko");
    expect(stored?.metadata.entity_id).toBe("person_ann");
    expect(stored?.metadata.content_type).toBe("profile");
  });

  it("prefers person entities on people searches and keeps ocean person seeds out of finance slugs", () => {
    const picked = pickPrimaryEntity(
      [
        { id: "company_x", type: "company", properties: { name: "Floodgate" } },
        { id: "person_ann", type: "person", properties: { name: "Ann Miura-Ko" } },
      ],
      "person",
    );
    expect(picked?.id).toBe("person_ann");
    expect(topicEntityMetaFromEntity({ entity: picked! })?.exa_type).toBe("person");
    const people = peopleSeeds();
    expect(people.length).toBeGreaterThanOrEqual(15);
    expect(people.every((row) => row.kind === "person")).toBe(true);
    const ocean = oceanEntities();
    expect(ocean.some((row) => row.slug === "ann-miura-ko")).toBe(true);
    expect(ocean.some((row) => row.slug === "byron-deeter")).toBe(true);
    for (const slug of FINANCE_SEED_SLUGS) {
      expect(ocean.some((row) => row.slug === slug)).toBe(false);
    }
    const richer = mergeTopicEntityMeta(
      { exa_entity_id: "person_old", exa_type: "person", name: "Old" },
      { exa_entity_id: "person_ann", exa_type: "person", name: "Ann", workHistory: [{ title: "Partner" }] },
    );
    expect(richer?.exa_entity_id).toBe("person_ann");
    expect(topicEntityMetaFromHits([])).toBeNull();
  });
});
