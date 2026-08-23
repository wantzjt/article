import { NextResponse } from "next/server";
import { ADMIN_SECRET } from "@/lib/env";
import { ingestTopic } from "@/lib/compiler/pipeline";
import { SEED_ENTITIES } from "@/lib/seed/entities";

export const maxDuration = 300;
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  if (!ADMIN_SECRET) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${ADMIN_SECRET}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  const slug = body.slug;
  if (!slug || !SEED_ENTITIES.some((entity) => entity.slug === slug)) {
    return NextResponse.json({ error: "unknown_slug" }, { status: 400 });
  }
  const result = await ingestTopic(slug);
  return NextResponse.json(result);
}
