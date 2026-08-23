import { generateText, gateway, Output, stepCountIs } from "ai";
import type { ZodType } from "zod";
import { PRIMARY_MODEL } from "@/lib/env";
import { estimateCostUsd } from "@/lib/compiler/spend";
import type { PipelineStage } from "@/lib/compiler/types";

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

export async function generateStructured<T>(input: {
  stage: PipelineStage;
  topicId?: string;
  system: string;
  prompt: string;
  schema: ZodType<T>;
}): Promise<{ object: T; meta: GatewayCallMeta }> {
  const result = await generateText({
    model: gateway(PRIMARY_MODEL),
    output: Output.object({ schema: input.schema }),
    system: input.system,
    prompt: input.prompt,
    providerOptions: {
      gateway: {
        tags: tagsFor(input.stage, input.topicId),
      },
    },
  });
  if (result.output == null) {
    throw new Error(`structured output missing for stage ${input.stage}`);
  }
  const object = input.schema.parse(result.output);
  const usage = result.totalUsage
    ? {
        inputTokens: result.totalUsage.inputTokens,
        outputTokens: result.totalUsage.outputTokens,
      }
    : undefined;
  return {
    object,
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
    stopWhen: stepCountIs(input.maxSteps ?? 6),
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
