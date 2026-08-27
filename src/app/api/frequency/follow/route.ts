import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { setFollow } from "@/lib/frequency/store";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { getTopicBySlug } from "@/lib/store/json-store";

export const runtime = "nodejs";

const ACTIONS = new Set(["follow", "unfollow", "mute", "unmute"]);

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { slug?: string; action?: string } | null;
  const slug = body?.slug?.trim() ?? "";
  const action = body?.action ?? "";
  if (!slug || !ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const topic = await getTopicBySlug(slug);
  if (!topic || !isPublicTopicStatus(topic.topic.status)) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  try {
    const profile = await setFollow({
      userId: session.userId,
      topicId: topic.topic.id,
      slug,
      action: action as "follow" | "unfollow" | "mute" | "unmute",
    });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "follow_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
