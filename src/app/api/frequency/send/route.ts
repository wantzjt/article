import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { loadClassifications } from "@/lib/frequency/classify";
import { renderProfileMorning } from "@/lib/frequency/morning";
import { getProfile, getUserById, upsertUserByEmail } from "@/lib/frequency/store";
import { resendConfigured, sendEmail } from "@/lib/mail/resend";
import { getGraph } from "@/lib/store/json-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!resendConfigured()) {
    return NextResponse.json({ ok: true, sent: false, reason: "resend_not_wired" });
  }
  const body = (await request.json().catch(() => null)) as { to?: string } | null;
  const founder = process.env.FOUNDER_EMAIL?.trim().toLowerCase() ?? "";
  const session = await readSession();
  const wantFounder = body?.to === "founder" && Boolean(founder);

  let userId: string | null = null;
  let email: string | null = null;
  if (session) {
    const user = await getUserById(session.userId);
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    if (wantFounder && user.email !== founder && !cronAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    userId = wantFounder ? (await upsertUserByEmail(founder)).id : user.id;
    email = wantFounder ? founder : user.email;
  } else if (wantFounder && cronAuthorized(request)) {
    const founderUser = await upsertUserByEmail(founder);
    userId = founderUser.id;
    email = founderUser.email;
  } else {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const profile = userId ? await getProfile(userId) : null;
  if (!profile || !email) {
    return NextResponse.json({ ok: false, error: "no_profile" }, { status: 400 });
  }
  const graph = await getGraph();
  const classifications = await loadClassifications(graph);
  const morning = renderProfileMorning(graph, profile, new Date(), classifications);
  const result = await sendEmail({
    to: email,
    subject: `Your Frequency — ${morning.dateLabel}`,
    html: morning.html,
  });
  return NextResponse.json({
    ok: result.sent,
    sent: result.sent,
    to: email,
    rows: morning.count,
    error: result.error,
  });
}
