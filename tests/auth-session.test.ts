import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, newSession } from "@/lib/auth/session";
import {
  consumeLoginToken,
  issueLoginToken,
  resetFrequencyMemory,
  setFollow,
  upsertUserByEmail,
} from "@/lib/frequency/store";

describe("session cookie", () => {
  it("round-trips a signed user id and rejects a truncated payload", () => {
    const encoded = encodeSession(newSession("user_1"));
    expect(decodeSession(encoded)?.userId).toBe("user_1");
    expect(decodeSession(encoded.slice(0, -2))).toBeNull();
  });
});

describe("magic link store", () => {
  it("issues a one-time token and will not follow Hugging Face", async () => {
    resetFrequencyMemory();
    const user = await upsertUserByEmail("Founder@Article.fm");
    expect(user.email).toBe("founder@article.fm");
    const token = await issueLoginToken(user.id);
    expect(await consumeLoginToken(token)).toMatchObject({ id: user.id });
    expect(await consumeLoginToken(token)).toBeNull();
    await expect(
      setFollow({ userId: user.id, topicId: "topic_huggingface", slug: "huggingface", action: "follow" }),
    ).rejects.toThrow(/not_followable/);
  });
});
