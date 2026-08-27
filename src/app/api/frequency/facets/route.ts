import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { setFacet } from "@/lib/frequency/store";
import { getTopicBySlug } from "@/lib/store/json-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    facet?: string;
    weight?: number;
  } | null;
  const slug = body?.slug?.trim() ?? "";
  const facet = body?.facet?.trim() ?? "";
  const weight = Number(body?.weight);
  if (!slug || !facet) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  const topic = await getTopicBySlug(slug);
  if (!topic) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  try {
    const profile = await setFacet({
      userId: session.userId,
      topicId: topic.topic.id,
      slug,
      facet,
      weight,
    });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "facet_failed";
    return NextResponse.json({ ok: false, error: "invalid_facet" }, { status: 400 });
  }
}
