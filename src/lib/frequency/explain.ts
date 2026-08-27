import { FACETS, type Facet } from "./facets";
import type { FrequencyProfile, RankedChange } from "./rank";

export const FACET_LABEL: Record<Facet, string> = {
  technology: "Technology",
  products: "Products",
  personnel: "Personnel",
  economic: "Economic",
  regulatory: "Regulation",
  partnerships: "Partnerships",
};

export function careLabel(weight: number | undefined): "Less" | "Normal" | "More" {
  if (!weight) return "Normal";
  return weight < 0 ? "Less" : "More";
}

export function topicEmphasis(
  facets: Partial<Record<Facet, number>> | undefined,
  muted: boolean,
): "HIGH" | "NORMAL" | "LOW" | "MUTED" {
  if (muted) return "MUTED";
  const values = FACETS.map((facet) => facets?.[facet] ?? 0);
  if (values.some((value) => value > 0)) return "HIGH";
  if (values.some((value) => value < 0)) return "LOW";
  return "NORMAL";
}

export function explainWhy(row: RankedChange): string {
  const parts: string[] = [];
  if (row.followed) {
    parts.push(`You follow ${row.name}`);
    const care = careLabel(
      row.personalRelevance >= 1.4 ? 2 : row.personalRelevance <= 0.7 ? -2 : 0,
    );
    if (care !== "Normal") {
      parts.push(`and have ${FACET_LABEL[row.facet]} set to ${care}`);
    } else {
      parts.push(`with ${FACET_LABEL[row.facet]} at Normal`);
    }
  } else if (row.relatedSlug) {
    parts.push(`This is connected to a Topic you follow`);
  } else {
    parts.push(`${row.name} is moving in the world`);
  }
  const lead = `${parts.join(" ")}.`;
  if (row.breakthrough || row.changeKind === "disputed") {
    return row.changeKind === "disputed"
      ? `${lead} Sources disagree, and it is material enough to interrupt.`
      : `${lead} This change is highly material.`;
  }
  return lead;
}

export function frequencyRows(
  profile: FrequencyProfile,
  names: Map<string, { slug: string; name: string }>,
): Array<{
  slug: string;
  name: string;
  muted: boolean;
  level: ReturnType<typeof topicEmphasis>;
  facets: Array<{ facet: Facet; label: string; care: ReturnType<typeof careLabel> }>;
}> {
  return profile.follows.map((follow) => {
    const topic = names.get(follow.topicId);
    const facets = profile.facets[follow.topicId] ?? {};
    return {
      slug: topic?.slug ?? follow.topicId,
      name: topic?.name ?? follow.topicId,
      muted: follow.muted,
      level: topicEmphasis(facets, follow.muted),
      facets: FACETS.map((facet) => ({
        facet,
        label: FACET_LABEL[facet],
        care: careLabel(facets[facet]),
      })),
    };
  });
}
