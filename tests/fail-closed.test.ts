import { describe, expect, it } from "vitest";
import { collectExaSources } from "@/lib/gateway/exa";
import {
  acceptVerifyObject,
  recordEmptyTimeoutCycle,
  secondNightDecision,
  shouldInventClaimsAfterDiscover,
  shouldRunExtract,
  statusAfterRenderTimeout,
} from "@/lib/compiler/fail-closed";
import { nightSkipReason } from "@/lib/compiler/night-policy";

describe("empty Exa does not invent claims", () => {
  it("collects nothing from empty tool results", () => {
    expect(collectExaSources([], ["openai news"])).toEqual([]);
    expect(collectExaSources([{ toolName: "exa_search", output: { results: [] } }], ["q"])).toEqual([]);
  });

  it("does not allow extract spam when discover is empty and the topic has no claims", () => {
    expect(shouldInventClaimsAfterDiscover({ discoveredCount: 0, existingAccepted: 0 })).toBe(false);
    expect(shouldRunExtract(0)).toBe(false);
    expect(shouldInventClaimsAfterDiscover({ discoveredCount: 3, existingAccepted: 0 })).toBe(true);
  });
});

describe("schema-invalid verify is a reject", () => {
  it("accepts only verdict supported", () => {
    expect(acceptVerifyObject({ verdict: "supported" })).toBe(true);
    expect(acceptVerifyObject({ verdict: "not_supported" })).toBe(false);
    expect(acceptVerifyObject({ answer: '{"verdict":"supported"}' })).toBe(false);
    expect(acceptVerifyObject({ explanation: "looks good" })).toBe(false);
    expect(acceptVerifyObject(null)).toBe(false);
  });
});

describe("render timeout graduates leftover claims", () => {
  it("promotes leftover public claims and never demotes strong", () => {
    expect(
      statusAfterRenderTimeout({
        currentStatus: "stub",
        leftoverPublicCount: 7,
        leftoverGraduate: "provisional",
      }),
    ).toBe("provisional");
    expect(
      statusAfterRenderTimeout({
        currentStatus: "strong",
        leftoverPublicCount: 0,
        leftoverGraduate: "stub",
      }),
    ).toBe("strong");
    expect(
      statusAfterRenderTimeout({
        currentStatus: "stub",
        leftoverPublicCount: 0,
        leftoverGraduate: "stub",
      }),
    ).toBe("stub");
  });
});

describe("openai-style empty timeouts skip after 2 cycles", () => {
  it("records cycles on the progress map and skips at 2 with 0 new claims", () => {
    let cycles = 0;
    cycles = recordEmptyTimeoutCycle({ timeout: true, claimsDelta: 0, timeoutCycles: cycles });
    expect(cycles).toBe(1);
    expect(nightSkipReason({ status: "stub", priorOk: false, timeoutCycles: cycles, lastClaimsDelta: 0 })).toBeNull();
    cycles = recordEmptyTimeoutCycle({ timeout: true, claimsDelta: 0, timeoutCycles: cycles });
    expect(cycles).toBe(2);
    expect(
      nightSkipReason({ status: "stub", priorOk: false, timeoutCycles: cycles, lastClaimsDelta: 0 }),
    ).toBe("timeout_burn");
    expect(recordEmptyTimeoutCycle({ timeout: false, claimsDelta: 0, timeoutCycles: 2 })).toBe(2);
  });
});

describe("double-start guard", () => {
  it("refuses a second instance while the lock PID is alive", () => {
    expect(
      secondNightDecision({
        lock: { pid: 5056, startedAt: "t0" },
        currentPid: 99,
        lockPidAlive: true,
      }),
    ).toBe("refuse");
    expect(
      secondNightDecision({
        lock: { pid: 5056, startedAt: "t0" },
        currentPid: 99,
        lockPidAlive: false,
      }),
    ).toBe("proceed");
    expect(secondNightDecision({ lock: null, currentPid: 99, lockPidAlive: false })).toBe("proceed");
  });
});
