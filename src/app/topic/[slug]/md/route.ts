import { NextResponse } from "next/server";
import { getTopicBySlug } from "@/lib/store/json-store";
import { topicMarkdown } from "@/lib/render/topic-view";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const graph = await getTopicBySlug(slug);
  if (!graph) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(topicMarkdown(graph), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
