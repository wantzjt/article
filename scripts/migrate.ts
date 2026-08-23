import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.info("No DATABASE_URL; skipping Neon migrate. Fixture store remains active.");
    return;
  }
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  const schema = await readFile(path.join(process.cwd(), "db/schema.sql"), "utf8");
  for (const statement of schema.split(";").map((part) => part.trim()).filter(Boolean)) {
    await sql.query(statement);
  }
  console.info("Neon schema applied.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
