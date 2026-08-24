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
import { PRIMARY_MODEL } from "@/lib/env";
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
  usage?: { inputTokens?: number; outputTokens?: number };
  costUsd: number;
};

function tagsFor(stage: PipelineStage, topicId?: string): string[] {
  const tags = [`stage:${stage}`, "promo:eve-gateway"];
  if (topicId) tags.push(`topic_id:${topicId}`);
  return tags;
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
      gateway: {
        tags: tagsFor(input.stage, input.topicId),
      },
    },
  });

  if (submitted == null) {
    const fallback = result.toolResults.find((row) => row.toolName === "submit_result");
    if (fallback && "input" in fallback) {
      submitted = input.schema.parse(fallback.input);
    }
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
          gateway: { tags: tagsFor(input.stage, input.topicId) },
        },
      });
      if (objectResult.output == null) {
        throw new Error(`structured output missing for stage ${input.stage}`);
      }
      submitted = input.schema.parse(objectResult.output);
      const usage = usageOf(objectResult);
      return {
        object: submitted,
        meta: {
          stage: input.stage,
          topicId: input.topicId,
          usage,
          costUsd: estimateCostUsd(usage),
        },
      };
    } catch (error) {
      if (isAbortError(error) || input.abortSignal?.aborted) throw error;
      throw structuredFailure(input.stage, error);
    }
  }

  const usage = usageOf(result);
  return {
    object: submitted,
    meta: {
      stage: input.stage,
      topicId: input.topicId,
      usage,
      costUsd: estimateCostUsd(usage),
    },
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
      gateway: {
        tags: tagsFor(input.stage, input.topicId),
      },
    },
  });
  const usage = result.totalUsage
    ? {
        inputTokens: result.totalUsage.inputTokens,
        outputTokens: result.totalUsage.outputTokens,
      }
    : undefined;
  return {
    result,
    meta: {
      stage: input.stage,
      topicId: input.topicId,
      usage,
      costUsd: estimateCostUsd(usage),
    } satisfies GatewayCallMeta,
  };
}
