import { ingestTopic } from "../src/lib/compiler/pipeline";
import { LAUNCH_DEMO_SLUG } from "../src/lib/seed/entities";

const slug = process.argv[2] ?? LAUNCH_DEMO_SLUG;

async function main() {
  const result = await ingestTopic(slug);
  console.info(JSON.stringify({ ok: true, ...result }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
