import { changesFromGraph } from "./changes";
import { morningRows, renderMorningFrequencyHtml, unsubscribeUrl } from "./email";
import { hasFollows, rankFrequency, type FrequencyProfile, type RankedChange } from "./rank";
import { unsubTokenFor } from "./store";
import type { GraphSnapshot } from "@/lib/store/graph";

export function dateLabelUtc(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);
}

export function renderProfileMorning(
  graph: GraphSnapshot,
  profile: FrequencyProfile,
  now = new Date(),
): { html: string; count: number; dateLabel: string; rows: RankedChange[] } {
  const ranked = hasFollows(profile) ? rankFrequency(changesFromGraph(graph, profile, now), profile, now) : [];
  const rows = morningRows(ranked);
  const dateLabel = dateLabelUtc(now);
  return {
    dateLabel,
    count: rows.length,
    rows,
    html: renderMorningFrequencyHtml({
      email: profile.email,
      dateLabel,
      rows,
      unsubUrl: unsubscribeUrl(unsubTokenFor(profile.userId)),
    }),
  };
}
