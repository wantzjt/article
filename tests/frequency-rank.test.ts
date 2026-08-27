import { describe, expect, it } from "vitest";
import { classifyFacet, facetMultiplier, inferFacet } from "@/lib/frequency/facets";
import {
  globalSignificance,
  hasFollows,
  rankFrequency,
  type FrequencyChange,
  type FrequencyProfile,
} from "@/lib/frequency/rank";
import { morningRows, renderMorningFrequencyHtml } from "@/lib/frequency/email";

function change(partial: Partial<FrequencyChange> & Pick<FrequencyChange, "slug" | "topicId">): FrequencyChange {
  return {
    name: partial.slug,
    status: "strong",
    kind: "company",
    lastMaterialChangeAt: "2026-08-27T12:00:00.000Z",
    lastVerifiedAt: "2026-08-27T12:00:00.000Z",
    sourceCount: 20,
    claimCount: 8,
    disputed: false,
    hasBrief: true,
    headline: "Material movement recorded.",
    changeSummary: "Material movement recorded.",
    facet: "technology",
    facetChild: null,
    sourceUrl: "https://example.com/source",
    sourceDomain: "example.com",
    ...partial,
  };
}

const now = new Date("2026-08-27T15:00:00.000Z");

describe("inferFacet", () => {
  it("uses kind when copy is quiet, keywords when they speak", () => {
    expect(inferFacet({ kind: "policy", text: "California AI bills" })).toBe("regulatory");
    expect(inferFacet({ kind: "model", text: "GLM-5.3 release and weights" })).toBe("technology");
    expect(inferFacet({ kind: "company", text: "New CEO appointed today" })).toBe("personnel");
  });

  it("labels Technology → Robotics when the copy already says so", () => {
    expect(classifyFacet({ kind: "company", text: "Unitree humanoid robot launch" })).toEqual({
      facet: "technology",
      child: "robotics",
    });
  });

  it("maps tuner steps to positive multipliers only", () => {
    expect(facetMultiplier(-2)).toBe(0.25);
    expect(facetMultiplier(-1)).toBe(0.6);
    expect(facetMultiplier(0)).toBe(1);
    expect(facetMultiplier(1)).toBe(1.5);
    expect(facetMultiplier(2)).toBe(2);
  });
});

describe("rankFrequency", () => {
  const glm = change({
    topicId: "topic_glm-5-3",
    slug: "glm-5-3",
    name: "GLM-5.3",
    kind: "model",
    facet: "technology",
  });
  const bills = change({
    topicId: "topic_ca-sb-53",
    slug: "ca-sb-53",
    name: "California AI bills",
    kind: "policy",
    facet: "regulatory",
    lastMaterialChangeAt: "2026-08-27T11:00:00.000Z",
  });
  const person = change({
    topicId: "topic_jensen",
    slug: "jensen-huang",
    name: "Jensen Huang",
    kind: "person",
    facet: "personnel",
    status: "provisional",
    sourceCount: 4,
    claimCount: 2,
    lastMaterialChangeAt: "2026-08-26T00:00:00.000Z",
  });
  const hf = change({
    topicId: "topic_huggingface",
    slug: "huggingface",
    name: "Hugging Face",
    sourceCount: 400,
    claimCount: 40,
  });

  it("drops muted topics and Hugging Face even when fat", () => {
    const profile: FrequencyProfile = {
      userId: "u1",
      email: "a@b.com",
      follows: [
        { topicId: glm.topicId, weight: 1, muted: false },
        { topicId: hf.topicId, weight: 1, muted: false },
        { topicId: person.topicId, weight: 1, muted: true },
      ],
      facets: {},
    };
    const ranked = rankFrequency([glm, person, hf], profile, now);
    expect(ranked.map((row) => row.slug)).toEqual(["glm-5-3"]);
    expect(ranked.some((row) => row.slug === "huggingface")).toBe(false);
    expect(ranked.some((row) => row.slug === "jensen-huang")).toBe(false);
  });

  it("keeps a tuned-down facet in the list, just quieter", () => {
    const profileUp: FrequencyProfile = {
      userId: "u1",
      email: "a@b.com",
      follows: [
        { topicId: glm.topicId, weight: 1, muted: false },
        { topicId: person.topicId, weight: 1, muted: false },
      ],
      facets: {
        [glm.topicId]: { technology: 2 },
        [person.topicId]: { personnel: -2 },
      },
    };
    const ranked = rankFrequency([glm, person], profileUp, now);
    expect(ranked.map((row) => row.slug)).toEqual(["glm-5-3", "jensen-huang"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[1].personalRelevance).toBe(0.25);
    expect(ranked.every((row) => row.personalRelevance > 0)).toBe(true);
  });

  it("lets a material unfollowed change interrupt", () => {
    const profile: FrequencyProfile = {
      userId: "u1",
      email: "a@b.com",
      follows: [{ topicId: person.topicId, weight: 1, muted: false }],
      facets: { [person.topicId]: { personnel: -2 } },
    };
    const ranked = rankFrequency([person, bills], profile, now);
    expect(ranked.some((row) => row.slug === "ca-sb-53" && row.breakthrough)).toBe(true);
    expect(hasFollows(profile)).toBe(true);
    expect(globalSignificance(bills, now)).toBeGreaterThan(0.62);
    expect(ranked.find((row) => row.slug === "ca-sb-53")?.reasons.join(" ")).toMatch(/breakthrough/);
  });
});

describe("morning email", () => {
  it("renders 5–8 dossier links and an unsubscribe, not a mill essay", () => {
    const rows = morningRows(
      Array.from({ length: 12 }, (_, i) => ({
        ...change({ topicId: `t${i}`, slug: `t-${i}`, name: `Topic ${i}` }),
        globalSignificance: 0.5,
        personalRelevance: 1,
        score: 0.5,
        followed: true,
        muted: false,
        breakthrough: false,
        reasons: ["followed"],
      })),
    );
    expect(rows).toHaveLength(8);
    const html = renderMorningFrequencyHtml({
      email: "a@b.com",
      dateLabel: "27 August 2026",
      rows,
      unsubUrl: "https://article.fm/unsubscribe?t=abc",
    });
    expect(html).toContain("/topic/t-0#what-changed");
    expect(html).toContain("example.com");
    expect(html).toContain("Unsubscribe");
    expect(html).toContain("Your Frequency");
    expect(html).not.toContain("7,000");
  });
});
