import type { ClassificationMap } from "./classify";
import { morningRows, renderMorningFrequencyHtml, unsubscribeUrl } from "./email";
import { buildFrequency } from "./engine";
import type { FrequencyProfile, RankedChange } from "./rank";
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
  classifications: ClassificationMap = {},
): { html: string; count: number; dateLabel: string; rows: RankedChange[]; orderKey: string } {
  const payload = buildFrequency(graph, profile, classifications, now);
  const rows = morningRows(payload.ranked);
  const dateLabel = dateLabelUtc(now);
  return {
    dateLabel,
    count: rows.length,
    rows,
    orderKey: payload.orderKey,
    html: renderMorningFrequencyHtml({
      email: profile.email,
      dateLabel,
      rows,
      unsubUrl: unsubscribeUrl(unsubTokenFor(profile.userId)),
    }),
  };
}
