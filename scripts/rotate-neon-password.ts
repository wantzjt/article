import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

function mustGet(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function replacePassword(url: string, password: string): string {
  const parsed = new URL(url);
  parsed.password = password;
  return parsed.toString();
}

async function main() {
  const current = mustGet("DATABASE_URL");
  const currentUnpooled = process.env.DATABASE_URL_UNPOOLED || current;
  const parsed = new URL(current);
  const role = decodeURIComponent(parsed.username);
  const nextPassword = randomBytes(24).toString("base64url");
  const sql = neon(current);
  await sql.query(`ALTER ROLE ${role} WITH PASSWORD '${nextPassword}'`);
  const pooled = replacePassword(current, nextPassword);
  const unpooled = replacePassword(currentUnpooled, nextPassword);
  writeFileSync("/tmp/article-db-url", pooled, { mode: 0o600 });
  writeFileSync("/tmp/article-db-url-unpooled", unpooled, { mode: 0o600 });
  writeFileSync("/tmp/article-db-password", nextPassword, { mode: 0o600 });
  chmodSync("/tmp/article-db-url", 0o600);
  chmodSync("/tmp/article-db-url-unpooled", 0o600);
  chmodSync("/tmp/article-db-password", 0o600);
  writeFileSync(
    "/tmp/article-rotate-meta.json",
    JSON.stringify({
      role,
      host: parsed.hostname,
      database: parsed.pathname.replace(/^\//, ""),
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "rotate failed");
  process.exit(1);
});
