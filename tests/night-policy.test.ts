import { describe, expect, it } from "vitest";
import {
  NIGHT_PRIORITY_SLUGS,
  buildNightQueue,
  nextNightStopMs,
  nightSkipReason,
  nightSpendCeilingUsd,
  nightStopReason,
} from "@/lib/compiler/night-policy";

describe("night stop clock (America/Chicago)", () => {
  it("stops at 06:00 CDT the same morning when started before 06:00", () => {
    // 05:59 CDT = 10:59 UTC in August
    const now = new Date("2026-08-26T10:59:00.000Z");
    expect(nextNightStopMs(now)).toBe(Date.parse("2026-08-26T11:00:00.000Z"));
  });

  it("rolls to the next 06:00 CDT after 06:00", () => {
    const now = new Date("2026-08-26T11:00:00.000Z");
    expect(nextNightStopMs(now)).toBe(Date.parse("2026-08-27T11:00:00.000Z"));
  });
});

describe("night stop reasons", () => {
  const base = {
    nowMs: 1_000,
    stopAtMs: 5_000,
    spendUsd: 1,
    spendCeilingUsd: 6.5,
    queueRemaining: 3,
    hardStopMs: 9_000,
  };

  it("ranks hard stop, then clock, then spend, then empty queue", () => {
    expect(nightStopReason({ ...base, nowMs: 9_000 })).toBe("hard_stop");
    expect(nightStopReason({ ...base, nowMs: 5_000 })).toBe("clock");
    expect(nightStopReason({ ...base, spendUsd: 6.5 })).toBe("spend");
    expect(nightStopReason({ ...base, queueRemaining: 0 })).toBe("queue");
    expect(nightStopReason(base)).toBeNull();
  });

  it("never lets the night ceiling exceed the daily model cap", () => {
    expect(nightSpendCeilingUsd(8, 6.5)).toBe(6.5);
    expect(nightSpendCeilingUsd(8, 20)).toBe(8);
    expect(nightSpendCeilingUsd(8, 0)).toBe(6.5);
  });
});

describe("night queue", () => {
  it("keeps the priority list first, then official-domain density, demo last", () => {
    const queue = buildNightQueue({
      seedSlugs: ["z-ai", "openai", "glm-5-3", "nvidia", "anthropic", "groq"],
      officialSourceCount: { "z-ai": 12, nvidia: 2, groq: 9, openai: 1 },
      demoSlug: "glm-5-3",
    });
    expect(queue.slice(0, 4)).toEqual(["anthropic", "openai", "nvidia", "groq"]);
    expect(queue.at(-1)).toBe("glm-5-3");
    expect(queue).toContain("z-ai");
    expect(NIGHT_PRIORITY_SLUGS[0]).toBe("anthropic");
  });
});

describe("night skip", () => {
  it("skips already-ok, strong, and two timeout cycles with no new claims", () => {
    expect(nightSkipReason({ status: "stub", priorOk: true, timeoutCycles: 0 })).toBe("already_ok");
    expect(nightSkipReason({ status: "strong", priorOk: false, timeoutCycles: 0 })).toBe("strong");
    expect(
      nightSkipReason({
        status: "stub",
        priorOk: false,
        timeoutCycles: 2,
        lastClaimsDelta: 0,
      }),
    ).toBe("timeout_burn");
    expect(
      nightSkipReason({
        status: "provisional",
        priorOk: false,
        timeoutCycles: 1,
        lastClaimsDelta: 0,
      }),
    ).toBeNull();
    expect(
      nightSkipReason({
        status: "stub",
        priorOk: false,
        timeoutCycles: 2,
        lastClaimsDelta: 3,
      }),
    ).toBeNull();
  });
});
