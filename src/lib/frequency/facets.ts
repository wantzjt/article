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

export type FacetClass = {
  facet: Facet;
  child: string | null;
};

const CHILD_PATTERNS: Array<[Facet, string, RegExp]> = [
  ["technology", "robotics", /\b(robot|humanoid|optimus|unitree|boston dynamics|figure ai|apptronik|agility robotics)\b/i],
  ["regulatory", "export-controls", /\bexport control/i],
  ["economic", "funding", /\b(series [a-d]|raised|funding round|ipo)\b/i],
];

/** Heuristic facet for v0. Compiler facets come later; this only ranks. */
export function inferFacet(input: { kind: string; text: string }): Facet {
  return classifyFacet(input).facet;
}

export function classifyFacet(input: { kind: string; text: string }): FacetClass {
  const blob = input.text;
  const childHit = CHILD_PATTERNS.find((row) => row[2].test(blob));
  if (childHit) return { facet: childHit[0], child: childHit[1] };
  let facet: Facet = KIND_FACET[input.kind] ?? "technology";
  for (const [next, pattern] of KEYWORD_FACETS) {
    if (pattern.test(blob)) {
      facet = next;
      break;
    }
  }
  return { facet, child: null };
}

const MULTIPLIER: Record<number, number> = {
  [-2]: 0.25,
  [-1]: 0.6,
  [0]: 1,
  [1]: 1.5,
  [2]: 2,
};

/** Positive relevance only. Mute is the only hard zero. */
export function facetMultiplier(weight: number): number {
  return MULTIPLIER[clampFacetWeight(weight)] ?? 1;
}
