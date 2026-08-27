import { describe, expect, it } from "vitest";
import {
  COMPILE_SKIP_SLUGS,
  compileAllowed,
  compileBlocked,
  compileRankBand,
  buildCompileQueue,
} from "@/lib/compiler/compile-priority";
import { buildNightQueue } from "@/lib/compiler/night-policy";
import { SEED_ENTITIES } from "@/lib/seed/entities";
import { getPersonSeedEntities } from "@/lib/seed/people";

describe("compile priority", () => {
  it("blocks huggingface and vector-db tourism even when fat", () => {
    expect(compileBlocked("huggingface")).toBe(true);
    expect(COMPILE_SKIP_SLUGS).toContain("pinecone");
    expect(compileAllowed({ slug: "huggingface", entityType: "lab" })).toBe(false);
    expect(compileAllowed({ slug: "pinecone", entityType: "infra" })).toBe(false);
    expect(compileAllowed({ slug: "chroma", entityType: "infra" })).toBe(false);
  });

  it("allows Pulse labs/models, people, chips, policy, robotics", () => {
    expect(compileAllowed({ slug: "openai", entityType: "lab" })).toBe(true);
    expect(compileAllowed({ slug: "nvidia", entityType: "infra" })).toBe(true);
    expect(compileAllowed({ slug: "eu-ai-act", entityType: "policy" })).toBe(true);
    expect(compileAllowed({ slug: "unitree", entityType: "company" })).toBe(true);
    expect(compileAllowed({ slug: "ann-miura-ko", entityType: "investor", kind: "person" })).toBe(true);
    expect(compileRankBand({ slug: "openai", entityType: "lab" })).toBe("spine");
    expect(compileRankBand({ slug: "ann-miura-ko", entityType: "investor", kind: "person" })).toBe("person");
  });

  it("ranks relevance before source richness and omits HF from queues", () => {
    const entities = [
      { slug: "huggingface", entityType: "lab" as const },
      { slug: "pinecone", entityType: "infra" as const },
      { slug: "unitree", entityType: "company" as const },
      { slug: "ann-miura-ko", entityType: "investor" as const, kind: "person" as const },
      { slug: "openai", entityType: "lab" as const },
    ];
    const queue = buildCompileQueue({
      entities,
      sourceCount: { huggingface: 900, pinecone: 800, unitree: 3, "ann-miura-ko": 1, openai: 10 },
    });
    expect(queue[0]).toBe("openai");
    expect(queue).toContain("ann-miura-ko");
    expect(queue).toContain("unitree");
    expect(queue).not.toContain("huggingface");
    expect(queue).not.toContain("pinecone");
    expect(queue.indexOf("ann-miura-ko")).toBeLessThan(queue.indexOf("unitree"));

    const night = buildNightQueue({
      seedSlugs: ["huggingface", "openai", "anthropic", "pinecone", "nvidia"],
      officialSourceCount: { huggingface: 999, pinecone: 500, nvidia: 2 },
    });
    expect(night[0]).toBe("anthropic");
    expect(night).not.toContain("huggingface");
    expect(night).not.toContain("pinecone");
    expect(SEED_ENTITIES.some((row) => row.slug === "huggingface")).toBe(true);
    expect(getPersonSeedEntities().some((row) => row.slug === "ann-miura-ko")).toBe(true);
  });
});
