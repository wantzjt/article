import {
  extractJsonMiddleware,
  generateText,
  gateway,
  NoObjectGeneratedError,
  Output,
  stepCountIs,
  tool,
  wrapLanguageModel,
} from "ai";
import type { ZodType } from "zod";
import {
  COMPILE_MODEL_FALLBACK,
  PRIMARY_MODEL,
  isFreeGlm52Compile,
} from "@/lib/env";
import { estimateCostUsd } from "@/lib/compiler/spend";
import { isAbortError } from "@/lib/compiler/timeout";
import type { PipelineStage } from "@/lib/compiler/types";

const structuredModel = wrapLanguageModel({
  model: gateway(PRIMARY_MODEL),
  middleware: extractJsonMiddleware(),
});

export type GatewayCallMeta = {
  stage: PipelineStage;
  topicId?: string;
  model: string;
  provider?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  costUsd: number;
};

function tagsFor(stage: PipelineStage, topicId?: string): string[] {
  const tags = [
    `stage:${stage}`,
    `model:${PRIMARY_MODEL}`,
    "promo:eve-gateway",
  ];
  if (isFreeGlm52Compile()) tags.push("promo:glm-5.2-blackbox");
  if (topicId) tags.push(`topic_id:${topicId}`);
  return tags;
}

function gatewayOptions(stage: PipelineStage, topicId?: string) {
  return {
    tags: tagsFor(stage, topicId),
    // Never list glm-5.3 here unless COMPILE_MODEL_FALLBACK is set.
    ...(COMPILE_MODEL_FALLBACK ? { models: [COMPILE_MODEL_FALLBACK] } : {}),
  };
}

function readGatewayLine(result: {
  providerMetadata?: Record<string, unknown>;
}): { provider?: string; reportedCostUsd?: number } {
  const gw = result.providerMetadata?.gateway as Record<string, unknown> | undefined;
  if (!gw) return {};
  const routing = gw.routing as Record<string, unknown> | undefined;
  const provider =
    (typeof routing?.resolvedProvider === "string" && routing.resolvedProvider) ||
    (typeof gw.provider === "string" && gw.provider) ||
    undefined;
  const rawCost = gw.cost ?? gw.totalCost ?? gw.costUsd;
  const reportedCostUsd =
    typeof rawCost === "number"
      ? rawCost
      : typeof rawCost === "string"
        ? Number(rawCost)
        : undefined;
  return {
    provider,
    reportedCostUsd: Number.isFinite(reportedCostUsd) ? reportedCostUsd : undefined,
  };
}

function metaFor(
  stage: PipelineStage,
  topicId: string | undefined,
  result: {
    totalUsage?: { inputTokens?: number; outputTokens?: number };
    providerMetadata?: Record<string, unknown>;
  },
): GatewayCallMeta {
  const usage = usageOf(result);
  const line = readGatewayLine(result);
  return {
    stage,
    topicId,
    model: PRIMARY_MODEL,
    provider: line.provider,
    usage,
    costUsd: estimateCostUsd(usage, {
      model: PRIMARY_MODEL,
      reportedCostUsd: line.reportedCostUsd,
    }),
  };
}

function structuredFailure(stage: PipelineStage, error: unknown): Error {
  if (NoObjectGeneratedError.isInstance(error)) {
    const snippet = (error.text ?? "").replace(/\s+/g, " ").slice(0, 280);
    return new Error(
      `structured output failed at ${stage}: ${error.message}${snippet ? ` :: ${snippet}` : ""}`,
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

function coerceStructured<T>(raw: unknown, schema: ZodType<T>): T | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object" && "answer" in value) {
    const answer = (value as { answer: unknown }).answer;
    if (typeof answer === "string") {
      try {
        value = JSON.parse(answer);
      } catch {
        value = answer;
      }
    } else {
      value = answer;
    }
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function usageOf(result: { totalUsage?: { inputTokens?: number; outputTokens?: number } }) {
  return result.totalUsage
    ? {
        inputTokens: result.totalUsage.inputTokens,
        outputTokens: result.totalUsage.outputTokens,
      }
    : undefined;
}

export async function generateStructured<T>(input: {
  stage: PipelineStage;
  topicId?: string;
  system: string;
  prompt: string;
  schema: ZodType<T>;
  abortSignal?: AbortSignal;
}): Promise<{ object: T; meta: GatewayCallMeta }> {
  let submitted: T | null = null;
  const result = await generateText({
    model: gateway(PRIMARY_MODEL),
    abortSignal: input.abortSignal,
    tools: {
      submit_result: tool({
        description: "Submit the structured result. Do not write prose; call this tool.",
        inputSchema: input.schema,
        execute: async (object) => {
          submitted = input.schema.parse(object);
          return { ok: true };
        },
      }),
    },
    toolChoice: { type: "tool", toolName: "submit_result" },
    stopWhen: stepCountIs(2),
    system: `${input.system}\nYou must call submit_result. Never wrap the payload in an "answer" string.`,
    prompt: input.prompt,
    providerOptions: {
      gateway: gatewayOptions(input.stage, input.topicId),
    },
  });

  if (submitted == null) {
    const fallback = result.toolResults.find((row) => row.toolName === "submit_result");
    if (fallback && "input" in fallback) {
      submitted = coerceStructured(fallback.input, input.schema);
    }
  }
  if (submitted == null && result.text) {
    submitted = coerceStructured(result.text, input.schema);
  }

  if (submitted == null) {
    if (input.abortSignal?.aborted) {
      throw input.abortSignal.reason instanceof Error
        ? input.abortSignal.reason
        : new Error(`aborted at ${input.stage}`);
    }
    try {
      const objectResult = await generateText({
        model: structuredModel,
        abortSignal: input.abortSignal,
        output: Output.object({ schema: input.schema }),
        system: `${input.system}\nReturn only JSON matching the schema.`,
        prompt: input.prompt,
        providerOptions: {
          gateway: gatewayOptions(input.stage, input.topicId),
        },
      });
      if (objectResult.output == null) {
        throw new Error(`structured output missing for stage ${input.stage}`);
      }
      submitted = input.schema.parse(objectResult.output);
      return {
        object: submitted,
        meta: metaFor(input.stage, input.topicId, objectResult),
      };
    } catch (error) {
      if (isAbortError(error) || input.abortSignal?.aborted) throw error;
      throw structuredFailure(input.stage, error);
    }
  }

  return {
    object: submitted,
    meta: metaFor(input.stage, input.topicId, result),
  };
}

export async function generateWithExaSearch(input: {
  stage: PipelineStage;
  topicId?: string;
  system: string;
  prompt: string;
  exa: ReturnType<typeof gateway.tools.exaSearch>;
  maxSteps?: number;
}) {
  const result = await generateText({
    model: gateway(PRIMARY_MODEL),
    tools: { exa_search: input.exa },
    stopWhen: stepCountIs(input.maxSteps ?? 10),
    system: input.system,
    prompt: input.prompt,
    providerOptions: {
      gateway: gatewayOptions(input.stage, input.topicId),
    },
  });
  return {
    result,
    meta: metaFor(input.stage, input.topicId, result),
  };
}
