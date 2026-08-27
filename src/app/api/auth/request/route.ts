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
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
