import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { answerAsk } from "@/lib/ask/grounded";
import { glm53Fixture } from "@/lib/fixture/glm-5-3";
import { assembleTopic } from "@/lib/store/graph";
import { isAudioTopic } from "@/lib/audio/constants";

const graph = assembleTopic(glm53Fixture, glm53Fixture.topics[0]);

describe("grounded ask", () => {
  it("shows a persisted source link for a claim", () => {
    const result = answerAsk(graph, { kind: "claim", id: "clm_available_gateway" }, "show_source");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources[0]?.url).toMatch(/^https:\/\//);
    expect(result.sources[0]?.domain).toBe("vercel.com");
    expect(result.answer).toContain("vercel.com");
  });

  it("explains a dispute from stored support and dispute excerpts", () => {
    const result = answerAsk(graph, { kind: "disagreement", id: "clm_thinking_off_dispute" }, "why_disputed");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer).toMatch(/disputed/i);
    expect(result.sources.some((row) => row.supportType === "supports")).toBe(true);
    expect(result.sources.some((row) => row.supportType === "disputes")).toBe(true);
  });

  it("answers what changed from the persisted brief, not model memory", () => {
    const result = answerAsk(graph, { kind: "claim", id: "clm_available_gateway" }, "what_changed");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer).toContain("GLM-5.3 is on AI Gateway");
  });

  it("refuses a claim that is not on the topic", () => {
    const result = answerAsk(graph, { kind: "claim", id: "clm_not_real" }, "show_source");
    expect(result).toMatchObject({ ok: false, reason: "not_in_graph" });
  });

  it("refuses why-disputed on a supported claim", () => {
    const result = answerAsk(graph, { kind: "claim", id: "clm_available_gateway" }, "why_disputed");
    expect(result).toMatchObject({ ok: false, reason: "not_disputed" });
  });

  it("refuses unknown questions instead of chatting", () => {
    const result = answerAsk(graph, { kind: "claim", id: "clm_available_gateway" }, "what is the weather");
    expect(result).toMatchObject({ ok: false, reason: "unknown_question" });
  });

  it("answers a timeline event from the persisted change summary", () => {
    const result = answerAsk(graph, { kind: "timeline", id: "ver_glm53_launch" }, "what_changed");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer).toContain("Z.ai introduced GLM-5.3");
  });

  it("does not add a general chat box or rewrite Pulse", () => {
    const ask = readFileSync(path.join(process.cwd(), "src/components/grounded-ask.tsx"), "utf8");
    const questions = readFileSync(path.join(process.cwd(), "src/lib/ask/grounded.ts"), "utf8");
    const home = readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(questions).toMatch(/What changed\?/);
    expect(questions).toMatch(/Why is this disputed\?/);
    expect(questions).toMatch(/Show the source\./);
    expect(ask).toMatch(/ASK_QUESTIONS/);
    expect(ask).not.toMatch(/textarea/);
    expect(home).toMatch(/Claims come before prose/);
    expect(isAudioTopic("glm-5-3")).toBe(true);
    expect(isAudioTopic("ca-sb-53")).toBe(false);
  });
});
