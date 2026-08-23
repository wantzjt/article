import { describe, expect, it, vi } from "vitest";
import { AudioBudgetError, getOrCreateTopicAudio } from "@/lib/audio/brief";
import { createMemoryCache } from "@/lib/audio/cache";
import type { Synthesize } from "@/lib/audio/tts";
import { glm53Fixture } from "@/lib/fixture/glm-5-3";
import { assembleTopic } from "@/lib/store/graph";
import type { TopicGraph } from "@/lib/store/graph";

function glmGraph(): TopicGraph {
  return assembleTopic(glm53Fixture, glm53Fixture.topics[0]);
}

describe("getOrCreateTopicAudio", () => {
  it("calls TTS once then serves the cache for the same material hash", async () => {
    const cache = createMemoryCache();
    const tts: Synthesize = vi.fn(async ({ text }) => {
      void text;
      return {
        bytes: Buffer.from("fake-mp3"),
        contentType: "audio/mpeg",
      };
    });
    const graph = glmGraph();
    const first = await getOrCreateTopicAudio(graph, { cache, tts });
    const second = await getOrCreateTopicAudio(graph, { cache, tts });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(first.materialHash).toBe(second.materialHash);
    expect(tts).toHaveBeenCalledTimes(1);
    expect(vi.mocked(tts).mock.calls).toHaveLength(1);
    const spoken = vi.mocked(tts).mock.calls[0][0].text;
    expect(spoken).toContain("what changed");
    expect(spoken).not.toMatch(/confidence/i);
  });

  it("fails closed when the topic is not the launch demo", async () => {
    const graph = glmGraph();
    graph.topic.slug = "openai";
    await expect(
      getOrCreateTopicAudio(graph, { cache: createMemoryCache(), tts: vi.fn() }),
    ).rejects.toBeInstanceOf(AudioBudgetError);
  });
});
