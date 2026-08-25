import { NextResponse } from "next/server";
import { PRIMARY_MODEL, MAX_DAILY_MODEL_SPEND_USD, OCEAN_HARD_STOP } from "@/lib/env";
import { summarizeOcean } from "@/lib/compiler/ocean-report";
import { getGraph } from "@/lib/store/json-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const graph = await getGraph();
  const summary = summarizeOcean(graph);
  return NextResponse.json({
    ok: true,
    model: PRIMARY_MODEL,
    maxDailyModelSpendUsd: MAX_DAILY_MODEL_SPEND_USD,
    hardStop: OCEAN_HARD_STOP,
    urls: summary.urls,
    claims: summary.claims,
    topics: summary.topics,
    whatMovedCount: summary.whatMoved.length,
    whatMoved: summary.whatMoved.slice(0, 12).map((row) => ({
      slug: row.slug,
      status: row.status,
      lastMaterialChangeAt: row.lastMaterialChangeAt,
    })),
    spendTodayUsd: Number(summary.spendTodayUsd.toFixed(6)),
    lastRunAt: summary.lastRunAt,
  });
}
