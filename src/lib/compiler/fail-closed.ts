import { failClosedStatus } from "./publication";
import type { TopicStatus } from "./types";

/** Empty Exa must not invent claims. Existing accepted claims may remain. */
export function shouldInventClaimsAfterDiscover(input: {
  discoveredCount: number;
  existingAccepted: number;
}): boolean {
  if (input.discoveredCount === 0 && input.existingAccepted === 0) return false;
  return input.discoveredCount > 0 || input.existingAccepted > 0;
}

export function shouldRunExtract(sourceCount: number): boolean {
  return sourceCount > 0;
}

/** Schema-invalid or non-supported verify objects are rejects, not claims. */
export function acceptVerifyObject(object: unknown): boolean {
  if (!object || typeof object !== "object") return false;
  return (object as { verdict?: unknown }).verdict === "supported";
}

export function statusAfterRenderTimeout(input: {
  currentStatus: TopicStatus | undefined;
  leftoverPublicCount: number;
  leftoverGraduate: TopicStatus;
}): TopicStatus {
  if (input.leftoverPublicCount >= 1) {
    return failClosedStatus(input.currentStatus, input.leftoverGraduate);
  }
  return failClosedStatus(input.currentStatus, "stub");
}

export function recordEmptyTimeoutCycle(input: {
  timeout: boolean;
  claimsDelta: number;
  timeoutCycles: number;
}): number {
  if (input.timeout && input.claimsDelta <= 0) return input.timeoutCycles + 1;
  return input.timeoutCycles;
}

export type NightLockFile = {
  pid: number;
  startedAt: string;
};

export function secondNightDecision(input: {
  lock: NightLockFile | null;
  currentPid: number;
  lockPidAlive: boolean;
}): "proceed" | "refuse" {
  if (!input.lock) return "proceed";
  if (input.lock.pid === input.currentPid) return "proceed";
  return input.lockPidAlive ? "refuse" : "proceed";
}
