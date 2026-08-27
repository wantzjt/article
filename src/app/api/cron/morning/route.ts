import { NextResponse } from "next/server";
import { brand } from "@/lib/brand";
import { loadClassifications } from "@/lib/frequency/classify";
import { hasFollows } from "@/lib/frequency/rank";
import { renderProfileMorning } from "@/lib/frequency/morning";
import { listSubscribedProfiles } from "@/lib/frequency/store";
import { sendEmail, resendConfigured } from "@/lib/mail/resend";
import { getGraph } from "@/lib/store/json-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("authorization") ?? "";
    const secret = process.env.CRON_SECRET?.trim();
    if (secret && auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!resendConfigured()) {
      return NextResponse.json({ ok: true, sent: 0, reason: "resend_not_wired" });
    }
    const graph = await getGraph();
    const classifications = await loadClassifications(graph);
    const profiles = await listSubscribedProfiles();
    let sent = 0;
    for (const profile of profiles) {
      if (!hasFollows(profile)) continue;
      const morning = renderProfileMorning(graph, profile, new Date(), classifications);
      const result = await sendEmail({
        to: profile.email,
        subject: `Your Frequency — ${morning.dateLabel}`,
        html: morning.html,
      });
      if (result.sent) sent += 1;
    }
    return NextResponse.json({ ok: true, sent, site: brand.siteUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "cron_failed";
    return NextResponse.json({ ok: true, sent: 0, reason: "error", error: message.slice(0, 180) });
  }
}
