import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { interestById, slugsForSelection } from "@/lib/frequency/interest-tree";
import { replaceInterests, setFollow } from "@/lib/frequency/store";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { getTopicBySlug } from "@/lib/store/json-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { weights?: Record<string, number>; nodes?: string[] } | null;
  const weights: Record<string, number> = {};
  if (body?.weights && typeof body.weights === "object") {
    for (const [id, weight] of Object.entries(body.weights)) {
      if (!interestById(id)) continue;
      if (weight === -2 || weight === 0 || weight === 2) weights[id] = weight;
    }
  } else {
    for (const id of body?.nodes ?? []) {
      if (typeof id === "string" && interestById(id)) weights[id] = 2;
    }
  }
  if (Object.keys(weights).length === 0) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }

  const interestWeights: Record<string, number> = {};
  for (const [id, weight] of Object.entries(weights)) {
    const def = interestById(id);
    if (def && def.kind !== "topic") interestWeights[id] = weight;
  }
  await replaceInterests({ userId: session.userId, weights: interestWeights });

  const followIds = Object.entries(weights)
    .filter(([, weight]) => weight >= 0)
    .map(([id]) => id);
  for (const slug of slugsForSelection(followIds)) {
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
