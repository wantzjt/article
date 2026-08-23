import type { TopicGraph } from "@/lib/store/graph";
import { AudioBudgetError, assertSpeakable, scriptForTopic } from "./scriptForTopic";
import { cacheKey, defaultAudioCache, type AudioCache, type AudioBytes } from "./cache";
import { synthesizeWithGateway, type Synthesize } from "./tts";
import { estimatedMinutes, isAudioTopic } from "./constants";

export { AudioBudgetError };

export type BriefAudio = AudioBytes & {
  cached: boolean;
  materialHash: string;
  minutes: number;
};

export async function getOrCreateTopicAudio(
  graph: TopicGraph,
  deps?: { cache?: AudioCache; tts?: Synthesize },
): Promise<BriefAudio> {
  if (!isAudioTopic(graph.topic.slug)) {
    throw new AudioBudgetError("empty_script");
  }
  const script = scriptForTopic(graph);
  assertSpeakable(script);
  const key = cacheKey(script.topicId, script.materialHash);
  const cache = deps?.cache ?? defaultAudioCache();
  const hit = await cache.get(key);
  if (hit) {
    return {
      ...hit,
      cached: true,
      materialHash: script.materialHash,
      minutes: estimatedMinutes(script.characterCount),
    };
  }
  const tts = deps?.tts ?? synthesizeWithGateway;
  const generated = await tts({ text: script.text, topicId: script.topicId });
  await cache.put(key, generated);
  return {
    ...generated,
    cached: false,
    materialHash: script.materialHash,
    minutes: estimatedMinutes(script.characterCount),
  };
}

export function playMeta(graph: TopicGraph): { minutes: number; slug: string } | null {
  if (!isAudioTopic(graph.topic.slug)) return null;
  try {
    const script = scriptForTopic(graph);
    assertSpeakable(script);
    return { minutes: estimatedMinutes(script.characterCount), slug: graph.topic.slug };
  } catch {
    return null;
  }
}
