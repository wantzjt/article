import { getGraph } from "../src/lib/store/json-store";
import { loadGraphFromNeon, saveGraphToNeon } from "../src/lib/store/neon";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const local = await getGraph();
  await saveGraphToNeon(local);
  const neonGraph = await loadGraphFromNeon();
  console.info(
    JSON.stringify({
      topics: neonGraph?.topics.length ?? 0,
      sources: neonGraph?.sources.length ?? 0,
      claims: neonGraph?.claims.length ?? 0,
      glm_status: neonGraph?.topics.find((topic) => topic.slug === "glm-5-3")?.status ?? null,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "sync failed");
  process.exit(1);
});
