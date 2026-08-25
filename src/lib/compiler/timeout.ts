export const EXTRACT_STAGE_TIMEOUT_MS = 120_000;
export const VERIFY_STAGE_TIMEOUT_MS = 120_000;
export const VERIFY_CALL_TIMEOUT_MS = 120_000;
export const CLUSTER_STAGE_TIMEOUT_MS = 90_000;

export class StageTimeoutError extends Error {
  readonly stage: string;
  readonly durationMs: number;

  constructor(stage: string, durationMs: number) {
    super(`stage timeout: ${stage} after ${durationMs}ms`);
    this.name = "StageTimeoutError";
    this.stage = stage;
    this.durationMs = durationMs;
  }
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError" || name === "TimeoutError" || error instanceof StageTimeoutError;
}

export function stageSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

export async function runWithStageTimeout<T>(
  stage: string,
  ms: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const started = Date.now();
  const signal = stageSignal(ms);
  try {
    return await new Promise<T>((resolve, reject) => {
      const fail = () => reject(new StageTimeoutError(stage, Date.now() - started));
      if (signal.aborted) {
        fail();
        return;
      }
      signal.addEventListener("abort", fail, { once: true });
      work(signal).then(resolve, (error: unknown) => {
        if (signal.aborted || isAbortError(error)) {
          fail();
          return;
        }
        reject(error);
      });
    });
  } catch (error) {
    if (error instanceof StageTimeoutError) throw error;
    if (signal.aborted || isAbortError(error)) {
      throw new StageTimeoutError(stage, Date.now() - started);
    }
    throw error;
  }
}
