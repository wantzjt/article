import { readFileSync } from "node:fs";
import path from "node:path";
import type { SeedEntity } from "@/lib/compiler/types";

const PEOPLE_PATH = path.join(process.cwd(), "data", "seeds-people.json");

let cached: SeedEntity[] | null = null;

export function getPersonSeedEntities(): SeedEntity[] {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(PEOPLE_PATH, "utf8")) as SeedEntity[];
  cached = raw.filter((row) => row.slug && row.name && row.kind === "person");
  return cached;
}
