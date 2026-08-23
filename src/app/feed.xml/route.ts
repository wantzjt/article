import { NextResponse } from "next/server";
import { brand } from "@/lib/brand";
import { listPublishedBriefs } from "@/lib/store/json-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const briefs = await listPublishedBriefs();
  const items = briefs
    .map(
      (brief) => `  <item>
    <title>${escapeXml(brief.headline)}</title>
    <link>${brand.siteUrl}/topic/${brief.topicSlug}</link>
    <guid>${brand.siteUrl}/topic/${brief.topicSlug}#${brief.id}</guid>
    <pubDate>${new Date(brief.publishedAt).toUTCString()}</pubDate>
    <description>${escapeXml(brief.summary)}</description>
  </item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(brand.productName)}</title>
  <link>${brand.siteUrl}</link>
  <description>${escapeXml(brand.tagline)}</description>
${items}
</channel>
</rss>`;
  return new NextResponse(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
