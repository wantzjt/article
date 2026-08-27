import { describe, expect, it } from "vitest";
import { assembleTopic, emptyGraph, topicIdFromSource } from "@/lib/store/graph";
import {
  personIdentity,
  warehouseCoverage,
  warehouseInventory,
  warehouseSourceList,
} from "@/lib/render/topic-view";
import { glm53Fixture } from "@/lib/fixture/glm-5-3";
import { playMeta } from "@/lib/audio/brief";
import { isAudioTopic } from "@/lib/audio/constants";
import type { SourceRecord, TopicRecord } from "@/lib/compiler/types";

function source(partial: Partial<SourceRecord> & Pick<SourceRecord, "id" | "canonicalUrl">): SourceRecord {
  return {
    title: partial.title ?? partial.id,
    publisher: partial.publisher ?? "example.com",
    publisherDomain: partial.publisherDomain ?? "example.com",
    author: null,
    publishedAt: partial.publishedAt ?? "2026-08-25T00:00:00.000Z",
    retrievedAt: partial.retrievedAt ?? "2026-08-25T19:00:00.000Z",
    sourceType: "reporting",
    primaryStatus: "secondary",
    contentHash: partial.id,
    evidenceExcerpt: partial.evidenceExcerpt ?? "Public profile excerpt.",
    metadata: partial.metadata ?? {},
    ...partial,
  };
}

describe("warehouse sources on topic graph", () => {
  it("includes banked metadata sources that are not claim-linked", () => {
    const graph = emptyGraph();
    graph.topics.push({
      id: "topic_lenny-pruss",
      slug: "lenny-pruss",
      name: "Lenny Pruss",
      entityType: "investor",
      kind: "person",
      description: "Partner at Amplify Partners.",
      aliases: [],
      officialDomains: ["amplifypartners.com"],
      status: "stub",
      createdAt: "t",
      updatedAt: "t",
      lastVerifiedAt: null,
      lastMaterialChangeAt: null,
    });
    graph.sources.push(
      source({
        id: "s1",
        canonicalUrl: "https://amplifypartners.com/team/lenny",
        metadata: { topic_id: "topic_lenny-pruss", topicId: "topic_lenny-pruss" },
      }),
    );
    const topic = assembleTopic(graph, graph.topics[0]);
    expect(topic.sources).toHaveLength(1);
    expect(topic.claims).toHaveLength(0);
    expect(topicIdFromSource(topic.sources[0])).toBe("topic_lenny-pruss");
  });

  it("does not add Play to a person stub", () => {
    expect(isAudioTopic("lenny-pruss")).toBe(false);
    const graph = assembleTopic(glm53Fixture, glm53Fixture.topics[0]);
    expect(playMeta({ ...graph, topic: { ...graph.topic, slug: "lenny-pruss", status: "stub" } })).toBeNull();
  });
});

describe("person identity from entity_meta", () => {
  it("uses current role and company and never invents a bio", () => {
    const identity = personIdentity({
      exa_entity_id: "person_ann",
      exa_type: "person",
      name: "Ann Miura-Ko",
      location: "Palo Alto, California, United States",
      workHistory: [
        {
          title: "Partner",
          dates: { from: "2008-01-01", to: null },
          company: { id: "company_floodgate", name: "Floodgate" },
        },
      ],
      description: "do not dump this as a biography",
    });
    expect(identity).toEqual({
      name: "Ann Miura-Ko",
      role: "Partner",
      company: "Floodgate",
      location: "Palo Alto, California, United States",
    });
    expect(JSON.stringify(identity)).not.toContain("biography");
  });

  it("returns null when there is no public person payload", () => {
    expect(personIdentity(null)).toBeNull();
    expect(personIdentity({ exa_entity_id: "company_x", exa_type: "company", name: "Floodgate" })).toBeNull();
  });
});

describe("explore coverage", () => {
  it("counts URLs and lists person plus source-rich stubs", () => {
    const graph = emptyGraph();
    const person: TopicRecord = {
      id: "topic_ann-miura-ko",
      slug: "ann-miura-ko",
      name: "Ann Miura-Ko",
      entityType: "investor",
      kind: "person",
      description: "Partner at Floodgate.",
      aliases: [],
      officialDomains: ["floodgate.com"],
      status: "stub",
      createdAt: "t",
      updatedAt: "t",
      lastVerifiedAt: null,
      lastMaterialChangeAt: null,
    };
    const stub: TopicRecord = {
      id: "topic_openai",
      slug: "openai",
      name: "OpenAI",
      entityType: "lab",
      description: "Lab.",
      aliases: [],
      officialDomains: ["openai.com"],
      status: "stub",
      createdAt: "t",
      updatedAt: "t",
      lastVerifiedAt: null,
      lastMaterialChangeAt: null,
    };
    graph.topics.push(person, stub);
    graph.sources.push(
      source({
        id: "p1",
        canonicalUrl: "https://floodgate.com/ann",
        retrievedAt: "2026-08-25T19:50:00.000Z",
        metadata: { topic_id: person.id },
      }),
      source({
        id: "o1",
        canonicalUrl: "https://openai.com/index/a",
        retrievedAt: "2026-08-25T18:00:00.000Z",
        metadata: { topic_id: stub.id },
      }),
      source({
        id: "o2",
        canonicalUrl: "https://openai.com/index/b",
        retrievedAt: "2026-08-25T18:01:00.000Z",
        metadata: { topicId: stub.id },
      }),
    );
    const coverage = warehouseCoverage(graph);
    expect(coverage.urls).toBe(3);
    expect(coverage.stub).toBe(2);
    expect(coverage.people).toBe(1);
    expect(coverage.lastRetrievedAt).toBe("2026-08-25T19:50:00.000Z");
    const inventory = warehouseInventory(graph);
    expect(inventory[0]?.slug).toBe("ann-miura-ko");
    expect(inventory[0]?.banked).toBe(true);
    expect(inventory.some((row) => row.slug === "openai" && row.sourceCount === 2)).toBe(true);
    expect(warehouseSourceList(graph.sources, 1)).toHaveLength(1);
  });
});
