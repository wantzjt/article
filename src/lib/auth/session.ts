import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "afm_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function secret(): string {
  const value = process.env.AUTH_SECRET?.trim() || process.env.ADMIN_SECRET?.trim();
  if (value) return value;
  if (process.env.VITEST) return "vitest-auth-secret";
  throw new Error("AUTH_SECRET is not set");
}

export type Session = {
  userId: string;
  exp: number;
};

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(session: Session): string {
  const payload = `${session.userId}.${session.exp}`;
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(raw: string | undefined | null): Session | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, expRaw, sig] = parts;
  const payload = `${userId}.${expRaw}`;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  if (!userId) return null;
  return { userId, exp };
}

export function newSession(userId: string, now = Date.now()): Session {
  return { userId, exp: Math.floor(now / 1000) + THIRTY_DAYS };
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  };
}
