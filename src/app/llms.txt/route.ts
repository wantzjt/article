import { NextResponse } from "next/server";
import { brand } from "@/lib/brand";
import { listTopics } from "@/lib/store/json-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const topics = (await listTopics()).filter((topic) => topic.status === "strong");
  const body = [
    `# ${brand.productName}`,
    "",
    brand.tagline,
    "",
    "Strong topics:",
    ...topics.map(
      (topic) =>
        `- [${topic.name}](${brand.siteUrl}/topic/${topic.slug}/md): ${topic.description}`,
    ),
    "",
    `Methodology: ${brand.siteUrl}/methodology`,
  ].join("\n");
  return new NextResponse(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
