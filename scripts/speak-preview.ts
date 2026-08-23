import { getTopicBySlug } from "../src/lib/store/json-store";
import { assertSpeakable, scriptForTopic } from "../src/lib/audio/scriptForTopic";

async function main() {
  const graph = await getTopicBySlug("glm-5-3");
  if (!graph) throw new Error("missing topic");
  const script = scriptForTopic(graph);
  assertSpeakable(script);
  console.info(
    JSON.stringify({
      chars: script.characterCount,
      claims: script.claimIds.length,
      hash: script.materialHash.slice(0, 12),
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
