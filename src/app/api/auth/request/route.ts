import { NextResponse } from "next/server";
import { requestMagicLink, safeNextPath } from "@/lib/auth/magic-link";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; next?: string } | null;
  const email = body?.email?.trim() ?? "";
  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  try {
    const result = await requestMagicLink(email, safeNextPath(body?.next));
    if (result.sent) {
      return NextResponse.json({ ok: true, sent: true, email: result.email });
    }
    if (result.loginUrl) {
      return NextResponse.json({
        ok: true,
        sent: false,
        email: result.email,
        loginUrl: result.loginUrl,
      });
    }
    return NextResponse.json(
      { ok: false, sent: false, error: result.error ?? "send_failed" },
      { status: 503 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
