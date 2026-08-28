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
    "This file is a discovery map for agents. It does not train models.",
    "Canonical pages are the source of truth: claims, sources, disagreements, timeline.",
    "",
    `Explore: ${brand.siteUrl}/explore`,
    `About: ${brand.siteUrl}/about`,
    `Methodology: ${brand.siteUrl}/methodology`,
    `Corrections: ${brand.siteUrl}/corrections`,
    "",
    "Strong topics:",
    ...topics.map(
      (topic) =>
        `- [${topic.name}](${brand.siteUrl}/topic/${topic.slug}): ${topic.description}`,
    ),
    "",
    "Machine-readable topic: append /md to a topic URL.",
  ].join("\n");
  return new NextResponse(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
