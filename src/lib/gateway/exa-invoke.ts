import { gateway } from "ai";
import { getVercelOidcToken } from "@vercel/oidc";
import { EXA_NUM_RESULTS, EXA_SEARCH_TYPE, EXA_VEHICLE_MODEL } from "@/lib/env";
import { exaModelVehicleAllowed, resolveExaVehicleModel } from "@/lib/compiler/exa-ocean";
import { exaToolArgsForPass, type ExaCategory } from "@/lib/compiler/taxonomy";
import { hitsFromExaOutput, type DiscoveredSource } from "./exa";

const GATEWAY_LM = "https://ai-gateway.vercel.sh/v4/ai/language-model";

export type ExaInvokeErrorKind = "rate_limit" | "http" | "empty" | "auth" | "quota";

export async function readGatewayCredits(): Promise<{ balanceUsd: number | null }> {
  try {
    const credits = await gateway.getCredits();
    const n = Number(credits.balance);
    return { balanceUsd: Number.isFinite(n) ? n : null };
  } catch {
    return { balanceUsd: null };
  }
}

export type ExaInvokeResult = {
  query: string;
  hits: DiscoveredSource[];
  gatewayCostUsd: number;
  error?: { kind: ExaInvokeErrorKind; status?: number; message: string };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getVercelOidcToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "ai-gateway-protocol-version": "0.0.1",
    "ai-gateway-auth-method": "oidc",
    "ai-language-model-specification-version": "4",
    "ai-language-model-streaming": "false",
    "ai-language-model-id": resolveExaVehicleModel(EXA_VEHICLE_MODEL),
  };
}

function parseGatewayCost(body: Record<string, unknown>): number {
  const gw = (body.providerMetadata as { gateway?: { cost?: string | number } } | undefined)?.gateway;
  const raw = gw?.cost;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function toolResultFromContent(content: unknown): unknown {
  if (!Array.isArray(content)) return null;
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const row = part as { type?: string; result?: unknown; output?: unknown };
    if (row.type === "tool-result") return row.result ?? row.output;
  }
  return null;
}

/**
 * Execute `gateway.tools.exaSearch()` as a Gateway provider tool.
 * Does not import structured/text generation helpers. A one-shot language-model
 * request is the only Gateway surface that runs provider Exa; this runner
 * never extract/verify/renders. Prompt is a forced tool call, then stop.
 */
export async function invokeExaSearch(input: {
  query: string;
  category?: ExaCategory;
  queryTag?: string;
  includeDomains?: string[];
  startPublishedDate?: string;
}): Promise<ExaInvokeResult> {
  if (process.env.EXA_API_KEY) {
    throw new Error("EXA_API_KEY is set; ocean:exa uses gateway.tools.exaSearch() only.");
  }
  if (!exaModelVehicleAllowed()) {
    return {
      query: input.query,
      hits: [],
      gatewayCostUsd: 0,
      error: {
        kind: "quota",
        message:
          "Blocked model vehicle: Exa provider tool requires a language-model request that bills Gateway credits. EXA_ALLOW_MODEL_VEHICLE is unset.",
      },
    };
  }
  const passArgs = exaToolArgsForPass(
    { category: input.category ?? "web", includeDomains: input.includeDomains },
    input.startPublishedDate,
  );
  const tool = gateway.tools.exaSearch({
    type: EXA_SEARCH_TYPE,
    numResults: EXA_NUM_RESULTS,
    category: passArgs.category,
    includeDomains: passArgs.includeDomains,
    startPublishedDate: passArgs.startPublishedDate,
    contents: {
      highlights: { maxCharacters: 800 },
      text: { maxCharacters: 2000 },
    },
  });
  const body = {
    prompt: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Call exa_search exactly once with query: ${JSON.stringify(input.query)} then stop.`,
          },
        ],
      },
    ],
    maxOutputTokens: 80,
    toolChoice: { type: "tool", toolName: "exa_search" },
    tools: [
      {
        type: "provider",
        id: tool.id,
        name: "exa_search",
        args: tool.args ?? {},
      },
    ],
  };

  let lastError: ExaInvokeResult["error"];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const res = await fetch(GATEWAY_LM, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : Math.min(30_000, 1000 * 2 ** attempt);
        lastError = { kind: res.status === 429 ? "rate_limit" : "http", status: res.status, message: await res.text() };
        await sleep(waitMs);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        return {
          query: input.query,
          hits: [],
          gatewayCostUsd: 0,
          error: { kind: "auth", status: res.status, message: await res.text() },
        };
      }
      if (!res.ok) {
        const message = (await res.text()).slice(0, 400);
        const quota = res.status === 402 || /quota_for_entity_exceeded|budget exceeded/i.test(message);
        return {
          query: input.query,
          hits: [],
          gatewayCostUsd: 0,
          error: { kind: quota ? "quota" : "http", status: res.status, message },
        };
      }
      const json = (await res.json()) as Record<string, unknown>;
      const hits = hitsFromExaOutput(toolResultFromContent(json.content), input.query, {
        exaCategory: input.category,
        queryTag: input.queryTag,
      });
      return {
        query: input.query,
        hits,
        gatewayCostUsd: parseGatewayCost(json),
        error: hits.length === 0 ? { kind: "empty", message: "no exa hits" } : undefined,
      };
    } catch (error) {
      lastError = { kind: "http", message: error instanceof Error ? error.message : "fetch_failed" };
      await sleep(Math.min(30_000, 1000 * 2 ** attempt));
    }
  }
  return { query: input.query, hits: [], gatewayCostUsd: 0, error: lastError };
}
