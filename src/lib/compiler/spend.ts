import { FREE_COMPILE_MODEL, MAX_DAILY_MODEL_SPEND_USD, isFreeGlm52Compile } from "../env";

export class ModelSpendCapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelSpendCapError";
  }
}

export function estimateCostUsd(
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  },
  options?: { model?: string; reportedCostUsd?: number; now?: Date },
): number {
  if (typeof options?.reportedCostUsd === "number" && Number.isFinite(options.reportedCostUsd)) {
    return Math.max(0, options.reportedCostUsd);
  }
  const model = options?.model;
  if (model && isFreeGlm52Compile(model, options?.now)) return 0;
  const input = usage?.inputTokens ?? 0;
  const output = usage?.outputTokens ?? 0;
  const rates =
    model === FREE_COMPILE_MODEL
      ? { in: 0.8, out: 2.5234 }
      : { in: 1.4, out: 4.4 };
  return (input * rates.in + output * rates.out) / 1_000_000;
}

export function assertUnderModelCap(spentUsd: number): void {
  if (spentUsd >= MAX_DAILY_MODEL_SPEND_USD) {
    throw new ModelSpendCapError(
      `Daily model spend cap hit (${MAX_DAILY_MODEL_SPEND_USD} USD). Exa Gateway promo is not included in this cap.`,
    );
  }
}
