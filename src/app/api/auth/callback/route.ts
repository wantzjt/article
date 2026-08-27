import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/magic-link";
import { encodeSession, newSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { consumeLoginToken } from "@/lib/frequency/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const next = safeNextPath(url.searchParams.get("next"));
  const user = token ? await consumeLoginToken(token) : null;
  if (!user) {
    return NextResponse.redirect(new URL("/signin?error=expired", url.origin));
  }
  const response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.set(SESSION_COOKIE, encodeSession(newSession(user.id)), sessionCookieOptions());
  return response;
}
