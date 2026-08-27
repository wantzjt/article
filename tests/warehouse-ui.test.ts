import { describe, expect, it } from "vitest";
import { assembleTopic, emptyGraph, topicIdFromSource } from "@/lib/store/graph";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  latestEvidence,
  namesAlign,
  personIdentity,
  pulseTopics,
  radarTopics,
  warehouseCoverage,
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

  it("does not treat a different Exa person as the topic", () => {
    expect(namesAlign("Lenny Pruss", "Sam Dore")).toBe(false);
    expect(namesAlign("Ann Miura-Ko", "Ann Miura-Ko")).toBe(true);
  });
});

describe("pulse radar index", () => {
  it("caps pulse at 8 and radar at 12, ranked by recency times source count", () => {
    const graph = emptyGraph();
    const now = new Date("2026-08-26T12:00:00.000Z");
    for (let i = 0; i < 14; i += 1) {
      graph.topics.push({
        id: `topic_${i}`,
        slug: `t-${i}`,
        name: `Topic ${i}`,
        entityType: i % 2 === 0 ? "lab" : "investor",
        kind: i % 2 === 0 ? "company" : "person",
        description: "Seed.",
        aliases: [],
        officialDomains: [],
        status: "stub",
        createdAt: "t",
        updatedAt: "t",
        lastVerifiedAt: null,
        lastMaterialChangeAt: `2026-08-2${i < 10 ? "5" : "4"}T0${i % 9}:00:00.000Z`,
      });
      const n = i === 0 ? 10 : 3;
      for (let s = 0; s < n; s += 1) {
        graph.sources.push(
          source({
            id: `s-${i}-${s}`,
            canonicalUrl: `https://example.com/${i}/${s}`,
            retrievedAt: i === 0 ? "2026-08-26T11:00:00.000Z" : "2026-08-01T00:00:00.000Z",
            metadata: { topic_id: `topic_${i}` },
          }),
        );
      }
    }
    const moved = graph.topics.filter((row) => row.lastMaterialChangeAt);
    const pulse = pulseTopics(moved);
    expect(pulse.visible).toHaveLength(8);
    expect(pulse.rest.length).toBeGreaterThan(0);
    const radar = radarTopics(graph, now);
    expect(radar.length).toBeLessThanOrEqual(12);
    expect(radar[0]?.slug).toBe("t-0");
    expect(radar.some((row) => row.kind === "person")).toBe(true);
    expect(radar.some((row) => row.kind === "company")).toBe(true);
    expect(latestEvidence(graph.sources, 5).length).toBeLessThanOrEqual(5);
    expect(warehouseCoverage(graph).urls).toBe(graph.sources.length);
  });

  it("explore is pulse/radar/index, not a coverage dump", () => {
    const home = readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
    const dossier = readFileSync(path.join(process.cwd(), "src/components/topic-view.tsx"), "utf8");
    expect(home).toMatch(/Pulse/);
    expect(home).toMatch(/Radar/);
    expect(home).toMatch(/Index/);
    expect(home).not.toMatch(/>Coverage</);
    expect(home).not.toMatch(/All topics/);
    expect(home).not.toMatch(/stub — sources banked/);
    expect(dossier).toMatch(/Latest evidence/);
    expect(dossier).toMatch(/All sources/);
    expect(dossier).not.toMatch(/claimText: source/);
    expect(isAudioTopic("glm-5-3")).toBe(true);
    expect(isAudioTopic("huggingface")).toBe(false);
  });
});
