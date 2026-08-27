import { brand } from "@/lib/brand";
import { sendEmail } from "@/lib/mail/resend";
import { issueLoginToken, upsertUserByEmail } from "@/lib/frequency/store";

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/";
  return raw;
}

export async function requestMagicLink(email: string, nextPath = "/"): Promise<{
  email: string;
  sent: boolean;
  loginUrl?: string;
}> {
  const user = await upsertUserByEmail(email);
  const token = await issueLoginToken(user.id);
  const next = safeNextPath(nextPath);
  const loginUrl = `${brand.siteUrl}/api/auth/callback?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
  const html = `<p>Sign in to ${brand.productName}.</p><p><a href="${loginUrl}">Open your Frequency</a></p><p>This link expires in 15 minutes.</p>`;
  const mail = await sendEmail({
    to: user.email,
    subject: `Sign in to ${brand.productName}`,
    html,
  });
  return {
    email: user.email,
    sent: mail.sent,
    loginUrl: mail.sent ? undefined : loginUrl,
  };
}
