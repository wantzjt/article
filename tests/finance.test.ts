import { describe, expect, it } from "vitest";
import {
  ENTITY_TYPES,
  FINANCE_CLAIM_KINDS,
} from "@/lib/compiler/types";
import {
  financeDiscoverQueries,
  isFinanceEntityType,
  isForbiddenFinanceDomain,
  isFinanceClaimKind,
  statusFromFinanceEvidence,
} from "@/lib/compiler/finance";
import { getEntityBySlug, SEED_ENTITIES } from "@/lib/seed/entities";
import { FINANCE_SEED_ENTITIES, FINANCE_SEED_SLUGS } from "@/lib/seed/finance";
import { gateCandidateClaim } from "@/lib/compiler/gate";
import { NIGHT_PRIORITY_SLUGS, buildNightQueue } from "@/lib/compiler/night-policy";

describe("finance schema", () => {
  it("adds company, investor, and round_event without dropping prior types", () => {
    expect(ENTITY_TYPES).toEqual(
      expect.arrayContaining(["lab", "model", "company", "investor", "round_event"]),
    );
    expect(FINANCE_CLAIM_KINDS).toEqual([
      "raised_amount",
      "lead_investor",
      "round_stage",
      "filing_type",
      "reported_valuation",
    ]);
  });

  it("keeps finance seeds off the night ocean queue", () => {
    expect(SEED_ENTITIES.some((row) => row.slug === "andreessen-horowitz")).toBe(false);
    expect(FINANCE_SEED_ENTITIES.length).toBeGreaterThanOrEqual(15);
    expect(FINANCE_SEED_ENTITIES.length).toBeLessThanOrEqual(25);
    expect(new Set(FINANCE_SEED_ENTITIES.map((row) => row.entityType))).toEqual(
      new Set(["investor", "round_event"]),
    );
    expect(getEntityBySlug("andreessen-horowitz")?.entityType).toBe("investor");
    expect(getEntityBySlug("openai-funding")?.entityType).toBe("round_event");
    expect(getEntityBySlug("glm-5-3")?.launchDemo).toBe(true);
    expect(isFinanceEntityType("investor")).toBe(true);
    expect(isFinanceEntityType("lab")).toBe(false);
    const nightQueue = buildNightQueue({
      seedSlugs: SEED_ENTITIES.map((row) => row.slug),
      officialSourceCount: {},
      demoSlug: "glm-5-3",
    });
    for (const slug of FINANCE_SEED_SLUGS) {
      expect(nightQueue).not.toContain(slug);
      expect((NIGHT_PRIORITY_SLUGS as readonly string[]).includes(slug)).toBe(false);
    }
  });

  it("never treats reported valuation as consensus-supported", () => {
    expect(
      statusFromFinanceEvidence({
        kind: "reported_valuation",
        supportingDomains: 3,
        disputingDomains: 0,
      }),
    ).toBe("single_source");
    expect(
      statusFromFinanceEvidence({
        kind: "reported_valuation",
        supportingDomains: 1,
        disputingDomains: 1,
      }),
    ).toBe("disputed");
    expect(
      statusFromFinanceEvidence({
        kind: "raised_amount",
        supportingDomains: 2,
        disputingDomains: 0,
      }),
    ).toBe("supported");
    expect(isFinanceClaimKind("reported_valuation")).toBe(true);
    expect(isFinanceClaimKind("gossip")).toBe(false);
  });

  it("drops Crunchbase/PitchBook as sources of record and still requires a source id", () => {
    expect(isForbiddenFinanceDomain("crunchbase.com")).toBe(true);
    expect(isForbiddenFinanceDomain("news.crunchbase.com")).toBe(true);
    expect(isForbiddenFinanceDomain("pitchbook.com")).toBe(true);
    expect(isForbiddenFinanceDomain("sec.gov")).toBe(false);
    expect(financeDiscoverQueries("Andreessen Horowitz", "a16z.com").some((q) => q.includes("sec.gov"))).toBe(
      true,
    );
    expect(
      gateCandidateClaim({
        claimText: "The company raised $500 million",
        sourceId: "",
        evidenceExcerpt: "The company raised $500 million",
        dates: [],
        numbers: ["500"],
        entities: [],
        financeKind: "raised_amount",
      }).ok,
    ).toBe(false);
  });
});
