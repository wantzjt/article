import { materialHash } from "@/lib/compiler/hash";
import type { TopicGraph } from "@/lib/store/graph";
import { scriptFromClaims, type BriefScript } from "./scriptFromClaims";
import { TTS_MAX_CHARS } from "./constants";

export type TopicScript = BriefScript & {
  topicId: string;
  materialHash: string;
};

export function scriptForTopic(graph: TopicGraph): TopicScript {
  const claims = graph.claims.map((claim) => ({
    id: claim.id,
    claimText: claim.claimText,
    status: claim.status,
  }));
  const hash =
    graph.versions.at(-1)?.materialHash ??
    materialHash(claims);
  const script = scriptFromClaims({
    topicName: graph.topic.name,
    whatChangedIds: graph.briefs[0]?.renderData.claimIds,
    claims,
  });
  return {
    ...script,
    topicId: graph.topic.id,
    materialHash: hash,
  };
}

export function assertSpeakable(script: BriefScript): void {
  if (!script.text.trim() || script.claimIds.length === 0) {
    throw new AudioBudgetError("empty_script");
  }
  if (script.characterCount > TTS_MAX_CHARS) {
    throw new AudioBudgetError("over_budget");
  }
}

export class AudioBudgetError extends Error {
  constructor(readonly code: "empty_script" | "over_budget") {
    super(code);
    this.name = "AudioBudgetError";
  }
}
