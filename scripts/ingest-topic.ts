import { CompileSkipError } from "../src/lib/compiler/compile-priority";
import { ingestTopic } from "../src/lib/compiler/pipeline";
import { LAUNCH_DEMO_SLUG } from "../src/lib/seed/entities";

const slug = process.argv[2] ?? LAUNCH_DEMO_SLUG;

async function main() {
  const result = await ingestTopic(slug);
  console.info(JSON.stringify({ ok: true, ...result }));
}

main().catch((error) => {
  if (error instanceof CompileSkipError) {
    console.info(JSON.stringify({ ok: true, skipped: true, slug: error.slug, reason: error.message }));
    process.exit(0);
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
