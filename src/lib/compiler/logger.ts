export function logPipeline(event: {
  runId: string;
  topicId?: string;
  stage?: string;
  sourceCount?: number;
  claimsProposed?: number;
  claimsAccepted?: number;
  claimsRejected?: number;
  retryCount?: number;
  durationMs?: number;
  model?: string;
  costUsd?: number;
  message?: string;
}): void {
  console.info(
    JSON.stringify({
      kind: "citationforge.pipeline",
      ts: new Date().toISOString(),
      ...event,
    }),
  );
}
