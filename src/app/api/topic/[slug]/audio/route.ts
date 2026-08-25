import { NextResponse } from "next/server";
import { getTopicBySlug } from "@/lib/store/json-store";
import { AudioBudgetError, getOrCreateTopicAudio } from "@/lib/audio/brief";
import { audioNotAvailableError } from "@/lib/audio/constants";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const unavailable = audioNotAvailableError(slug);
  if (unavailable) {
    return NextResponse.json({ error: unavailable }, { status: 404 });
  }
  const graph = await getTopicBySlug(slug);
  if (!graph) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const audio = await getOrCreateTopicAudio(graph);
    return new NextResponse(new Uint8Array(audio.bytes), {
      headers: {
        "Content-Type": audio.contentType,
        "Cache-Control": audio.cached
          ? "private, max-age=31536000, immutable"
          : "private, no-store",
        "X-Audio-Cache": audio.cached ? "hit" : "miss",
        "X-Audio-Hash": audio.materialHash,
      },
    });
  } catch (error) {
    if (error instanceof AudioBudgetError) {
      return NextResponse.json({ error: error.code }, { status: 422 });
    }
    console.error(
      JSON.stringify({
        kind: "citationforge.tts_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    return NextResponse.json({ error: "tts_failed" }, { status: 502 });
  }
}
