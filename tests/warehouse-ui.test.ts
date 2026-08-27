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

  it("keeps Hugging Face off Pulse and Radar even when the warehouse is fat", () => {
    const graph = emptyGraph();
    const now = new Date("2026-08-27T12:00:00.000Z");
    graph.topics.push({
      id: "topic_huggingface",
      slug: "huggingface",
      name: "Hugging Face",
      entityType: "lab",
      kind: "company",
      description: "Hub.",
      aliases: [],
      officialDomains: ["huggingface.co"],
      status: "provisional",
      createdAt: "t",
      updatedAt: "t",
      lastVerifiedAt: "2026-08-27T11:00:00.000Z",
      lastMaterialChangeAt: "2026-08-27T11:00:00.000Z",
    });
    graph.topics.push({
      id: "topic_ca-sb-53",
      slug: "ca-sb-53",
      name: "California AI bills",
      entityType: "policy",
      kind: "policy",
      description: "Bills.",
      aliases: [],
      officialDomains: ["ca.gov"],
      status: "strong",
      createdAt: "t",
      updatedAt: "t",
      lastVerifiedAt: "2026-08-27T10:00:00.000Z",
      lastMaterialChangeAt: "2026-08-27T10:00:00.000Z",
    });
    for (let s = 0; s < 40; s += 1) {
      graph.sources.push(
        source({
          id: `hf-${s}`,
          canonicalUrl: `https://huggingface.co/${s}`,
          retrievedAt: "2026-08-27T11:30:00.000Z",
          metadata: { topic_id: "topic_huggingface" },
        }),
      );
    }
    graph.sources.push(
      source({
        id: "ca-1",
        canonicalUrl: "https://leginfo.legislature.ca.gov/sb53",
        retrievedAt: "2026-08-26T00:00:00.000Z",
        metadata: { topic_id: "topic_ca-sb-53" },
      }),
    );
    const pulse = pulseTopics(graph.topics.filter((row) => row.lastMaterialChangeAt));
    expect(pulse.visible.map((row) => row.slug)).toEqual(["ca-sb-53"]);
    expect(radarTopics(graph, now).map((row) => row.slug)).toEqual(["ca-sb-53"]);
  });

  it("pins the launch spine ahead of other movement", () => {
    const topics = ["z-ai", "glm-5-3", "coreweave", "ca-sb-53"].map((slug) => ({
      id: `topic_${slug}`,
      slug,
      lastMaterialChangeAt: "2026-08-27T12:00:00.000Z",
    }));
    const pulse = pulseTopics(topics);
    expect(pulse.visible.map((row) => row.slug).slice(0, 3)).toEqual([
      "ca-sb-53",
      "glm-5-3",
      "coreweave",
    ]);
  });

  it("explore is The World and Frequency, not a glossary", () => {
    const home = readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
    const feed = readFileSync(path.join(process.cwd(), "src/components/world-feed.tsx"), "utf8");
    const header = readFileSync(path.join(process.cwd(), "src/components/site-header.tsx"), "utf8");
    const dossier = readFileSync(path.join(process.cwd(), "src/components/topic-view.tsx"), "utf8");
    const controls = readFileSync(path.join(process.cwd(), "src/components/frequency-controls.tsx"), "utf8");
    const board = readFileSync(path.join(process.cwd(), "src/components/frequency-board.tsx"), "utf8");
    const why = readFileSync(path.join(process.cwd(), "src/components/why-this.tsx"), "utf8");
    const methodology = readFileSync(path.join(process.cwd(), "src/app/methodology/page.tsx"), "utf8");
    const llms = readFileSync(path.join(process.cwd(), "src/app/llms.txt/route.ts"), "utf8");
    expect(home).toMatch(/Your Frequency/);
    expect(home).toMatch(/The World/);
    expect(home).toMatch(/Build my Frequency/);
    expect(board).toMatch(/Tune Frequency/);
    expect(board).toMatch(/Your weights/);
    expect(feed).toMatch(/moreCount/);
    expect(feed).toMatch(/#what-changed/);
    expect(why).toMatch(/Why this\?/);
    expect(feed).toMatch(/WhyThis/);
    expect(home).not.toMatch(/Radar/);
    expect(home).not.toMatch(/Index/);
    expect(home).not.toMatch(/Claims come before prose/);
    expect(header).toMatch(/Your Frequency/);
    expect(header).toMatch(/The World/);
    expect(header).toMatch(/Explore/);
    expect(header).toMatch(/Search/);
    expect(header).toMatch(/Morning Frequency/);
    expect(header).not.toMatch(/Methodology/);
    expect(controls).toMatch(/Less/);
    expect(controls).toMatch(/More/);
    expect(dossier).toMatch(/What changed/);
    expect(dossier).toMatch(/Current state/);
    expect(dossier).toMatch(/changeKindLabel/);
    const morning = readFileSync(path.join(process.cwd(), "src/app/frequency/preview/page.tsx"), "utf8");
    expect(morning).toMatch(/changeKindLabel/);
    expect(dossier).toMatch(/GroundedAsk/);
    expect(dossier).toMatch(/FrequencyControls/);
    expect(dossier).toMatch(/>\s*Ask\s*</);
    expect(dossier).not.toMatch(/claimText: source/);
    expect(methodology).toMatch(/Last retrieved/);
    expect(methodology).toMatch(/Frequency is a projection of this graph/);
    expect(llms).toMatch(/does not train models/);
    expect(isAudioTopic("glm-5-3")).toBe(true);
    expect(isAudioTopic("huggingface")).toBe(false);
    expect(isAudioTopic("glm-5-2")).toBe(false);
  });
});
