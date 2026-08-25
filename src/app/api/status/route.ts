import { NextResponse } from "next/server";
import { PRIMARY_MODEL, MAX_DAILY_MODEL_SPEND_USD, OCEAN_HARD_STOP } from "@/lib/env";
import { publicStatusPayload, summarizeOcean } from "@/lib/compiler/ocean-report";
import { getGraph } from "@/lib/store/json-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const graph = await getGraph();
  return NextResponse.json(
    publicStatusPayload({
      model: PRIMARY_MODEL,
      maxDailyModelSpendUsd: MAX_DAILY_MODEL_SPEND_USD,
      hardStop: OCEAN_HARD_STOP,
      summary: summarizeOcean(graph),
    }),
  );
}
