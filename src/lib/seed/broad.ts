import { readFileSync } from "node:fs";
import path from "node:path";
import type { SeedEntity } from "@/lib/compiler/types";
import { SEED_ENTITIES } from "./entities";

const BROAD_PATH = path.join(process.cwd(), "data", "seeds-broad.json");

let cached: SeedEntity[] | null = null;

function loadBroadFile(): SeedEntity[] {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(BROAD_PATH, "utf8")) as SeedEntity[];
  cached = raw.filter((row) => row.slug && row.name && row.entityType && Array.isArray(row.officialDomains));
  return cached;
}

export function getBroadSeedEntities(): SeedEntity[] {
  return loadBroadFile();
}

/** AI seeds plus broad tech/compute/policy/robotics. Finance seeds are excluded. */
export function getOceanEntities(): SeedEntity[] {
  const seen = new Set<string>();
  const out: SeedEntity[] = [];
  for (const row of [...SEED_ENTITIES, ...getBroadSeedEntities()]) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    out.push(row);
  }
  return out;
}

export function getOceanEntityBySlug(slug: string): SeedEntity | undefined {
  return getOceanEntities().find((row) => row.slug === slug);
}
