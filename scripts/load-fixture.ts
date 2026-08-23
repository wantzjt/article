import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { glm53Fixture } from "../src/lib/fixture/glm-5-3";
import { SEED_ENTITIES } from "../src/lib/seed/entities";
import type { GraphSnapshot } from "../src/lib/store/graph";

async function main() {
  const graph: GraphSnapshot = structuredClone(glm53Fixture);
  const now = new Date().toISOString();
  for (const entity of SEED_ENTITIES) {
    if (graph.topics.some((topic) => topic.slug === entity.slug)) continue;
    graph.topics.push({
      id: `topic_${entity.slug}`,
      slug: entity.slug,
      name: entity.name,
      entityType: entity.entityType,
      description: entity.description,
      aliases: entity.aliases,
      officialDomains: entity.officialDomains,
      status: "stub",
      createdAt: now,
      updatedAt: now,
      lastVerifiedAt: null,
      lastMaterialChangeAt: null,
    });
  }
  const target = path.join(process.cwd(), "data", "graph.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(graph, null, 2));
  console.info(`Wrote ${graph.topics.length} topics to data/graph.json`);
}

main();
