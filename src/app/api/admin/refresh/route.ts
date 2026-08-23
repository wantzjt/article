import { NextResponse } from "next/server";
import { ADMIN_SECRET } from "@/lib/env";
import { ingestTopic } from "@/lib/compiler/pipeline";
import { SEED_ENTITIES } from "@/lib/seed/entities";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!ADMIN_SECRET || request.headers.get("authorization") !== `Bearer ${ADMIN_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const slugs = SEED_ENTITIES.filter((entity) => entity.launchDemo).map((entity) => entity.slug);
  const results = [];
  for (const slug of slugs) {
    results.push(await ingestTopic(slug));
  }
  return NextResponse.json({ results });
}
