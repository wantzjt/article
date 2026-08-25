import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/store/json-store", () => ({
  getTopicBySlug: vi.fn(),
}));

vi.mock("@/lib/audio/brief", () => ({
  AudioBudgetError: class AudioBudgetError extends Error {
    code = "empty_script";
  },
  getOrCreateTopicAudio: vi.fn(),
}));

import { GET } from "@/app/api/topic/[slug]/audio/route";
import { getOrCreateTopicAudio } from "@/lib/audio/brief";
import { getTopicBySlug } from "@/lib/store/json-store";

describe("audio route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 cache-hit audio only for glm-5-3", async () => {
    vi.mocked(getTopicBySlug).mockResolvedValue({ topic: { slug: "glm-5-3" } } as never);
    vi.mocked(getOrCreateTopicAudio).mockResolvedValue({
      bytes: Buffer.from("ID3"),
      contentType: "audio/mpeg",
      cached: true,
      materialHash: "hash",
      minutes: 1,
    });
    const response = await GET(new Request("http://article.fm/api/topic/glm-5-3/audio"), {
      params: Promise.resolve({ slug: "glm-5-3" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(response.headers.get("X-Audio-Cache")).toBe("hit");
    expect(getOrCreateTopicAudio).toHaveBeenCalledOnce();
  });

  it("does not call TTS for a non-demo slug", async () => {
    const response = await GET(new Request("http://article.fm/api/topic/openai/audio"), {
      params: Promise.resolve({ slug: "openai" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "audio_not_available" });
    expect(getOrCreateTopicAudio).not.toHaveBeenCalled();
  });
});
