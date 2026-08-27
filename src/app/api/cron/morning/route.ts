import { NextResponse } from "next/server";
import { brand } from "@/lib/brand";
import { changesFromGraph } from "@/lib/frequency/changes";
import { morningRows, renderMorningFrequencyHtml, unsubscribeUrl } from "@/lib/frequency/email";
import { hasFollows, rankFrequency } from "@/lib/frequency/rank";
import { listSubscribedProfiles, unsubTokenFor } from "@/lib/frequency/store";
import { sendEmail, resendConfigured } from "@/lib/mail/resend";
import { getGraph } from "@/lib/store/json-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!resendConfigured()) {
    return NextResponse.json({ ok: true, sent: 0, reason: "resend_not_wired" });
  }
  const graph = await getGraph();
  const profiles = await listSubscribedProfiles();
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);
  let sent = 0;
  for (const profile of profiles) {
    if (!hasFollows(profile)) continue;
    const ranked = rankFrequency(changesFromGraph(graph, profile, now), profile, now);
    const rows = morningRows(ranked);
    const html = renderMorningFrequencyHtml({
      email: profile.email,
      dateLabel,
      rows,
      unsubUrl: unsubscribeUrl(unsubTokenFor(profile.userId)),
    });
    const result = await sendEmail({
      to: profile.email,
      subject: `Your Frequency — ${dateLabel}`,
      html,
    });
    if (result.sent) sent += 1;
  }
  return NextResponse.json({ ok: true, sent, site: brand.siteUrl });
}
