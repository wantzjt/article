export const FACETS = [
  "technology",
  "products",
  "personnel",
  "economic",
  "regulatory",
  "partnerships",
] as const;

export type Facet = (typeof FACETS)[number];

export const FACET_MIN = -2;
export const FACET_MAX = 2;

const KIND_FACET: Record<string, Facet> = {
  policy: "regulatory",
  person: "personnel",
  model: "technology",
  product: "products",
  event: "economic",
  company: "products",
  standard: "regulatory",
  concept: "technology",
};

const KEYWORD_FACETS: Array<[Facet, RegExp]> = [
  ["regulatory", /\b(bill|act|law|regul|export control|congress|senate|preempt|compliance)\b/i],
  ["personnel", /\b(ceo|hired|appoint|resign|personnel|employee|founder|executive|talent)\b/i],
  ["economic", /\b(fund|ipo|revenue|valuation|earnings|raised|pricing|market cap)\b/i],
  ["partnerships", /\b(partner|partnership|alliance|collaborat|supplier|customer deal)\b/i],
  ["technology", /\b(model|weights|benchmark|architecture|training|parameters|gpu|release)\b/i],
  ["products", /\b(product|launch|cloud|cluster|general availability|\bga\b|platform)\b/i],
];

export function isFacet(value: string): value is Facet {
  return (FACETS as readonly string[]).includes(value);
}

export function clampFacetWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(FACET_MIN, Math.min(FACET_MAX, Math.round(value)));
}

/** Heuristic facet for v0. Compiler facets come later; this only ranks. */
export function inferFacet(input: { kind: string; text: string }): Facet {
  const blob = input.text;
  for (const [facet, pattern] of KEYWORD_FACETS) {
    if (pattern.test(blob)) return facet;
  }
  return KIND_FACET[input.kind] ?? "technology";
}

/** Tune down is quieter, never a hide. −2 → 0.2, 0 → 1, +2 → 1.8 */
export function facetMultiplier(weight: number): number {
  return 1 + 0.4 * clampFacetWeight(weight);
}
