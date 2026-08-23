import { MAX_DAILY_MODEL_SPEND_USD } from "../env";

export class ModelSpendCapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelSpendCapError";
  }
}

export function estimateCostUsd(usage?: {
  inputTokens?: number;
  outputTokens?: number;
}): number {
  const input = usage?.inputTokens ?? 0;
  const output = usage?.outputTokens ?? 0;
  // Conservative placeholder until Gateway returns billed cost. GLM list is cheap; stay under the cap.
  return (input * 0.6 + output * 2.2) / 1_000_000;
}

export function assertUnderModelCap(spentUsd: number): void {
  if (spentUsd >= MAX_DAILY_MODEL_SPEND_USD) {
    throw new ModelSpendCapError(
      `Daily model spend cap hit (${MAX_DAILY_MODEL_SPEND_USD} USD). Exa Gateway promo is not included in this cap.`,
    );
  }
}
