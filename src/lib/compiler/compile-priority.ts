import { topicKind } from "./taxonomy";
import type { SeedEntity } from "./types";
import { getPersonSeedEntities } from "@/lib/seed/people";

/**
 * Off-spine platforms. Discover may bank sources; compile must not
 * chase richness. Hugging Face is a hub, not a project entity.
 */
export const COMPILE_SKIP_SLUGS = [
  "huggingface",
  "pinecone",
  "weaviate",
  "chroma",
  "qdrant",
  "milvus",
  "ollama",
  "replicate",
  "wandb",
  "langchain",
  "llamaindex",
  "crewai",
] as const;

const SKIP = new Set<string>(COMPILE_SKIP_SLUGS);

const SPINE = new Set<string>([
  "anthropic",
  "openai",
  "claude-4",
  "google-deepmind",
  "xai",
  "meta-ai",
  "mistral-ai",
  "nvidia",
  "groq",
  "databricks",
  "glm-5-3",
  "glm-5-2",
  "z-ai",
  "moonshot",
  "deepseek",
  "deepseek-v3",
  "gpt-5",
  "llama-4",
  "grok-4",
  "qwen-3",
  "mistral-large",
  "alibaba-qwen",
  "minimax",
]);

const CHIPS = new Set([
  "amd",
  "tsmc",
  "arm",
  "intel",
  "broadcom",
  "cerebras",
  "sambanova",
]);

const ROBOTICS = new Set([
  "unitree",
  "figure-ai",
  "boston-dynamics",
  "tesla-optimus",
  "agility-robotics",
  "apptronik",
  "1x-tech",
  "physical-intelligence",
]);

const COMPUTE = new Set(["coreweave", "lambda-labs", "crusoe", "groq"]);

export class CompileSkipError extends Error {
  readonly slug: string;
  constructor(slug: string) {
    super(`Compile skipped: ${slug} is off-spine (not a project compile entity)`);
    this.name = "CompileSkipError";
    this.slug = slug;
  }
}

export function compileBlocked(slug: string): boolean {
  return SKIP.has(slug);
}

export function compileAllowed(entity: Pick<SeedEntity, "slug" | "entityType"> & { kind?: SeedEntity["kind"] }): boolean {
  if (compileBlocked(entity.slug)) return false;
  if (process.env.COMPILE_FORCE === "1") return true;
  if (SPINE.has(entity.slug)) return true;
  if (topicKind(entity) === "person") return true;
  const kind = topicKind(entity);
  if (kind === "policy" || kind === "standard" || kind === "event") return true;
  if (kind === "model") return true;
  if (entity.entityType === "lab") return true;
  if (CHIPS.has(entity.slug) || ROBOTICS.has(entity.slug) || COMPUTE.has(entity.slug)) return true;
  return false;
}

export type CompileRankBand = "spine" | "person" | "relevant" | "skip";

export function compileRankBand(entity: Pick<SeedEntity, "slug" | "entityType"> & { kind?: SeedEntity["kind"] }): CompileRankBand {
  if (compileBlocked(entity.slug) || !compileAllowed(entity)) return "skip";
  if (SPINE.has(entity.slug)) return "spine";
  if (topicKind(entity) === "person") return "person";
  return "relevant";
}

const BAND_ORDER: Record<CompileRankBand, number> = { spine: 0, person: 1, relevant: 2, skip: 9 };

/** Relevance first, then source richness. Never richness alone. */
export function buildCompileQueue(input: {
  entities: Array<Pick<SeedEntity, "slug" | "entityType"> & { kind?: SeedEntity["kind"] }>;
  sourceCount?: Record<string, number>;
}): string[] {
  const density = input.sourceCount ?? {};
  return input.entities
    .filter((entity) => compileAllowed(entity))
    .sort((a, b) => {
      const band = BAND_ORDER[compileRankBand(a)] - BAND_ORDER[compileRankBand(b)];
      if (band !== 0) return band;
      return (density[b.slug] ?? 0) - (density[a.slug] ?? 0) || a.slug.localeCompare(b.slug);
    })
    .map((entity) => entity.slug);
}

export function personCompileSlugs(): string[] {
  return getPersonSeedEntities().map((row) => row.slug);
}
