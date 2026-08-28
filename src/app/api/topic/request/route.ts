import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { brand } from "@/lib/brand";
import { sendEmail } from "@/lib/mail/resend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { query?: string; email?: string } | null;
  const query = body?.query?.trim() ?? "";
  const email = body?.email?.trim() ?? "";
  if (query.length < 2 || query.length > 200) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (email && !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  const url = process.env.DATABASE_URL;
  if (url) {
    const sql = neon(url);
    await sql.query(
      `CREATE TABLE IF NOT EXISTS topic_requests (
         id text PRIMARY KEY,
         query text NOT NULL,
         email text,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await sql.query("INSERT INTO topic_requests (id, query, email) VALUES ($1, $2, $3)", [
      `req_${randomUUID()}`,
      query,
      email || null,
    ]);
  }
  await sendEmail({
    to: brand.correctionsEmail,
    subject: `Topic request: ${query.slice(0, 80)}`,
    html: `<p>Requested Topic: ${escapeHtml(query)}</p><p>From: ${escapeHtml(email || "anonymous")}</p>`,
  });
  return NextResponse.json({ ok: true });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
