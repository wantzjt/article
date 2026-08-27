import { PULSE_LIMIT } from "@/lib/render/topic-view";
import type { GraphSnapshot } from "@/lib/store/graph";
import type { ClassificationMap } from "./classify";
import { changesFromGraph } from "./changes";
import { hasFollows, rankFrequency, type FrequencyProfile, type RankedChange } from "./rank";

export type FrequencyPayload = {
  ranked: RankedChange[];
  visible: RankedChange[];
  rest: RankedChange[];
  orderKey: string;
};

/** One deterministic projection for Web and Email. No LLM. */
export function buildFrequency(
  graph: GraphSnapshot,
  profile: FrequencyProfile,
  classifications: ClassificationMap = {},
  now = new Date(),
): FrequencyPayload {
  const ranked = hasFollows(profile)
    ? rankFrequency(changesFromGraph(graph, profile, classifications), profile, now)
    : [];
  return {
    ranked,
    visible: ranked.slice(0, PULSE_LIMIT),
    rest: ranked.slice(PULSE_LIMIT),
    orderKey: ranked.map((row) => row.slug).join("|"),
  };
}
