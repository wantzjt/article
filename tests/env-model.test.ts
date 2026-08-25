import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "@/lib/compiler/spend";
import {
  FREE_COMPILE_MODEL,
  METERED_COMPILE_MODEL,
  isFreeGlm52Compile,
  isGlm52FreeWindow,
  resolvePrimaryModel,
} from "@/lib/env";

describe("compile model default", () => {
  it("defaults to zai/glm-5.2 during the Blackbox free window", () => {
    expect(resolvePrimaryModel({}, new Date("2026-08-26T12:00:00-05:00"))).toBe(FREE_COMPILE_MODEL);
    expect(isGlm52FreeWindow(new Date("2026-08-27T23:59:00-05:00"))).toBe(true);
  });

  it("flips default to metered glm-5.3 after 2026-08-27 23:59 CT", () => {
    expect(resolvePrimaryModel({}, new Date("2026-08-28T00:00:00-05:00"))).toBe(METERED_COMPILE_MODEL);
    expect(isGlm52FreeWindow(new Date("2026-08-28T00:00:00-05:00"))).toBe(false);
  });

  it("does not silently replace an explicit PRIMARY_MODEL", () => {
    expect(
      resolvePrimaryModel({ PRIMARY_MODEL: "zai/glm-5.2" }, new Date("2026-08-28T00:00:00-05:00")),
    ).toBe("zai/glm-5.2");
    expect(
      resolvePrimaryModel({ PRIMARY_MODEL: "zai/glm-5.3" }, new Date("2026-08-26T12:00:00-05:00")),
    ).toBe("zai/glm-5.3");
  });

  it("counts free 5.2 compile as $0 against the model cap", () => {
    const during = new Date("2026-08-26T12:00:00-05:00");
    expect(
      estimateCostUsd(
        { inputTokens: 10_000, outputTokens: 2_000 },
        { model: FREE_COMPILE_MODEL, now: during },
      ),
    ).toBe(0);
    expect(isFreeGlm52Compile(FREE_COMPILE_MODEL, during)).toBe(true);
    expect(
      estimateCostUsd(
        { inputTokens: 10_000, outputTokens: 2_000 },
        { model: FREE_COMPILE_MODEL, reportedCostUsd: 0.12, now: during },
      ),
    ).toBe(0.12);
  });
});
