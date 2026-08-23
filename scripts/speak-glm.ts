import { getTopicBySlug } from "../src/lib/store/json-store";
import { getOrCreateTopicAudio } from "../src/lib/audio/brief";

async function main() {
  const graph = await getTopicBySlug("glm-5-3");
  if (!graph) throw new Error("missing topic");
  const first = await getOrCreateTopicAudio(graph);
  const second = await getOrCreateTopicAudio(graph);
  console.info(
    JSON.stringify({
      firstCached: first.cached,
      secondCached: second.cached,
      bytes: first.bytes.length,
      minutes: first.minutes,
      sameHash: first.materialHash === second.materialHash,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
