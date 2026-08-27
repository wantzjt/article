import { brand } from "@/lib/brand";

export type MailResult = { sent: boolean; id?: string; error?: string };

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function mailFrom(): string {
  return (
    process.env.MAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    `${brand.productName} <noreply@article.fm>`
  );
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { sent: false, error: "resend_not_wired" };
  const from = mailFrom();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": "ArticleFm/1.0",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    const fallbackFrom = `${brand.productName} <noreply@tarx.com>`;
    if (from !== fallbackFrom && from.toLowerCase().includes("article.fm")) {
      const retry = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "User-Agent": "ArticleFm/1.0",
        },
        body: JSON.stringify({
          from: fallbackFrom,
          to: [input.to],
          subject: input.subject,
          html: input.html,
        }),
      });
      if (retry.ok) {
        const retried = (await retry.json()) as { id?: string };
        return { sent: true, id: retried.id };
      }
    }
    return { sent: false, error: text.slice(0, 180) };
  }
  const body = (await response.json()) as { id?: string };
  return { sent: true, id: body.id };
}
