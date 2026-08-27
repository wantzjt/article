import { describe, expect, it } from "vitest";
import {
  EXTRACT_STAGE_TIMEOUT_MS,
  StageTimeoutError,
  VERIFY_CALL_TIMEOUT_MS,
  VERIFY_STAGE_TIMEOUT_MS,
  runWithStageTimeout,
} from "@/lib/compiler/timeout";

describe("ingest stage timeouts", () => {
  it("uses 120s extract and a short verify call budget", () => {
    expect(EXTRACT_STAGE_TIMEOUT_MS).toBe(120_000);
    expect(VERIFY_STAGE_TIMEOUT_MS).toBe(120_000);
    expect(VERIFY_CALL_TIMEOUT_MS).toBe(20_000);
  });

  it("returns when work finishes inside the budget", async () => {
    await expect(runWithStageTimeout("extract", 1_000, async () => 7)).resolves.toBe(7);
  });

  it("fails closed on a hung extract with no retry", async () => {
    const attempts = { n: 0 };
    const started = Date.now();
    const caught = await runWithStageTimeout("extract", 40, async () => {
      attempts.n += 1;
      return new Promise(() => {});
    }).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(StageTimeoutError);
    expect(caught).toHaveProperty("stage", "extract");
    expect(attempts.n).toBe(1);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("fails closed on a hung verify", async () => {
    await expect(
      runWithStageTimeout("verify", 40, async () => new Promise(() => {})),
    ).rejects.toBeInstanceOf(StageTimeoutError);
  });
});
