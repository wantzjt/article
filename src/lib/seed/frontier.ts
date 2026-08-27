import { readFileSync } from "node:fs";
import path from "node:path";
import type { SeedEntity } from "@/lib/compiler/types";

const FRONTIER_PATH = path.join(process.cwd(), "data", "seeds-frontier.json");

let cached: SeedEntity[] | null = null;

export function getFrontierSeedEntities(): SeedEntity[] {
  if (cached) return cached;
  try {
    const raw = JSON.parse(readFileSync(FRONTIER_PATH, "utf8")) as SeedEntity[];
    cached = raw.filter((row) => row.slug && row.name && row.entityType);
    return cached;
  } catch {
    cached = [];
    return cached;
  }
}

export function resetFrontierSeedCache(): void {
  cached = null;
}
