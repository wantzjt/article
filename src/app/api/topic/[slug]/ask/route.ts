import { NextResponse } from "next/server";
import { answerAsk } from "@/lib/ask/grounded";
import { isAskTargetKind } from "@/lib/ask/types";
import { getTopicBySlug } from "@/lib/store/json-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const graph = await getTopicBySlug(slug);
  if (!graph) return NextResponse.json({ ok: false, reason: "not_in_graph", message: "Unknown topic." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as {
    question?: string;
    target?: { kind?: string; id?: string };
  } | null;
  const kind = body?.target?.kind ?? "";
  const id = body?.target?.id?.trim() ?? "";
  const question = body?.question ?? "";
  if (!isAskTargetKind(kind) || !id) {
    return NextResponse.json(
      { ok: false, reason: "not_in_graph", message: "Click a claim, source, disagreement, or timeline event." },
      { status: 400 },
    );
  }
  const result = answerAsk(graph, { kind, id }, question);
  return NextResponse.json(result);
}
