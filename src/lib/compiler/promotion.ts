import type { TopicStatus } from "./types";

export function isPublicTopicStatus(status: TopicStatus | string): boolean {
  return status === "stub" || status === "provisional" || status === "strong";
}

/**
 * Internal objects can be huge. Public dossiers need a bar.
 * candidate → stub is warehouse promotion. Claim graduation stays in publication.ts.
 */
export function promoteWarehouseStatus(input: {
  current: TopicStatus;
  sourceCount: number;
  qualityCount: number;
  edgeCount: number;
  claimCount: number;
}): TopicStatus {
  if (input.current === "strong" || input.current === "provisional") return input.current;
  const bar =
    input.sourceCount >= 5 &&
    (input.qualityCount >= 1 || input.edgeCount >= 2 || input.sourceCount >= 12 || input.claimCount >= 1);
  if (input.current === "candidate") return bar ? "stub" : "candidate";
  if (input.current === "stub" && input.sourceCount === 0 && input.claimCount === 0 && input.edgeCount === 0) {
    return "candidate";
  }
  return input.current;
}
