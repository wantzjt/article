import { ingestTopic } from "../src/lib/compiler/pipeline";
import { compileAllowed } from "../src/lib/compiler/compile-priority";
import { warehouseYieldLow } from "../src/lib/compiler/compile-chunk";
import { getOceanEntityBySlug } from "../src/lib/seed/broad";
import { topicIdFromSource } from "../src/lib/store/graph";
import { getGraph, modelSpendTodayUsd } from "../src/lib/store/json-store";

const MAX_TOPICS = Number(process.env.COMPILE_YIELD_TOPICS ?? "6");
const SPEND_CEILING = Number(process.env.COMPILE_YIELD_SPEND_USD ?? "4");

async function main() {
  const graph = await getGraph();
  const counts = new Map<string, number>();
  for (const source of graph.sources) {
    const id = topicIdFromSource(source);
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const claims = new Map<string, number>();
  for (const claim of graph.claims) {
    if (claim.status === "rejected") continue;
    claims.set(claim.topicId, (claims.get(claim.topicId) ?? 0) + 1);
  }
  const queue = graph.topics
    .filter((topic) => {
      const entity = getOceanEntityBySlug(topic.slug);
      if (!entity) return false;
      if (!compileAllowed(entity) && process.env.COMPILE_FORCE !== "1") return false;
      const sources = counts.get(topic.id) ?? 0;
      const accepted = claims.get(topic.id) ?? 0;
      return warehouseYieldLow(accepted, sources);
    })
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
    .slice(0, MAX_TOPICS);

  console.info(JSON.stringify({ event: "compile_yield_start", queue: queue.map((row) => row.slug) }));
  for (const topic of queue) {
    const spend = await modelSpendTodayUsd();
    if (spend >= SPEND_CEILING) {
      console.info(JSON.stringify({ event: "spend_stop", spend }));
      break;
    }
    try {
      const result = await ingestTopic(topic.slug);
      console.info(JSON.stringify({ event: "compile_ok", slug: topic.slug, ...result }));
    } catch (error) {
      console.info(
        JSON.stringify({
          event: "compile_fail",
          slug: topic.slug,
          error: error instanceof Error ? error.message : "fail",
        }),
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
