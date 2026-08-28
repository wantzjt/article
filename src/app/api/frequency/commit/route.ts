import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { interestById, slugsForSelection } from "@/lib/frequency/interests";
import { replaceInterests, setFollow } from "@/lib/frequency/store";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { getTopicBySlug } from "@/lib/store/json-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { nodes?: string[] } | null;
  const nodes = [...new Set((body?.nodes ?? []).filter((id) => typeof id === "string" && interestById(id)))];
  if (nodes.length === 0) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  const weights: Record<string, number> = {};
  for (const id of nodes) {
    const def = interestById(id);
    if (!def) continue;
    if (def.kind !== "topic") weights[id] = 2;
  }
  await replaceInterests({ userId: session.userId, weights });

  for (const slug of slugsForSelection(nodes)) {
    const topic = await getTopicBySlug(slug);
    if (!topic || !isPublicTopicStatus(topic.topic.status)) continue;
    await setFollow({
      userId: session.userId,
      topicId: topic.topic.id,
      slug,
      action: "follow",
    });
  }
  return NextResponse.json({ ok: true });
}
