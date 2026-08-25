import { FINANCE_CLAIM_KINDS, type EntityType, type FinanceClaimKind } from "./types";
import { statusFromEvidence } from "./claims";
import type { ClaimStatus } from "./types";

const FORBIDDEN = /(^|\.)(crunchbase|pitchbook|cbinsights|dealroom|tracxn)\./i;

export const FINANCE_ENTITY_TYPES = ["company", "investor", "round_event"] as const satisfies readonly EntityType[];
export const FINANCE_FILING_DOMAINS = ["sec.gov"];
export const FINANCE_WIRE_DOMAINS = ["businesswire.com", "prnewswire.com", "reuters.com"];

export function isFinanceEntityType(value: string | null | undefined): boolean {
  return Boolean(value && (FINANCE_ENTITY_TYPES as readonly string[]).includes(value));
}

export function isFinanceClaimKind(value: string | null | undefined): value is FinanceClaimKind {
  return Boolean(value && (FINANCE_CLAIM_KINDS as readonly string[]).includes(value));
}

/** Valuation is never consensus-supported — single-source or disputed only. */
export function statusFromFinanceEvidence(input: {
  kind?: FinanceClaimKind | null;
  supportingDomains: number;
  disputingDomains: number;
}): ClaimStatus {
  const base = statusFromEvidence({
    supportingDomains: input.supportingDomains,
    disputingDomains: input.disputingDomains,
  });
  if (input.kind !== "reported_valuation") return base;
  if (input.disputingDomains > 0 && input.supportingDomains > 0) return "disputed";
  if (input.supportingDomains >= 1) return "single_source";
  return base === "rejected" ? "rejected" : "unresolved";
}

export function isForbiddenFinanceDomain(domain: string): boolean {
  return FORBIDDEN.test(domain.toLowerCase());
}

export function financeDiscoverQueries(name: string, officialDomain?: string): string[] {
  const site = officialDomain ? ` site:${officialDomain}` : "";
  return [
    `${name} official announcement funding OR investment${site}`,
    `${name} Form D OR 8-K OR press release site:sec.gov`,
    `${name} lead investor Series A OR Series B OR Series C`,
    `${name} investor thesis infrastructure OR agents OR developer tools`,
  ];
}
