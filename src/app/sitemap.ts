import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
import { listTopics } from "@/lib/store/json-store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const topics = await listTopics();
  const indexable = topics.filter((topic) => topic.status === "strong");
  return [
    { url: brand.siteUrl, changeFrequency: "hourly", priority: 1 },
    { url: `${brand.siteUrl}/explore`, changeFrequency: "hourly" },
    { url: `${brand.siteUrl}/search`, changeFrequency: "weekly" },
    { url: `${brand.siteUrl}/start`, changeFrequency: "weekly" },
    { url: `${brand.siteUrl}/about`, changeFrequency: "monthly" },
    { url: `${brand.siteUrl}/help`, changeFrequency: "monthly" },
    { url: `${brand.siteUrl}/privacy`, changeFrequency: "monthly" },
    { url: `${brand.siteUrl}/terms`, changeFrequency: "monthly" },
    { url: `${brand.siteUrl}/methodology`, changeFrequency: "monthly" },
    { url: `${brand.siteUrl}/corrections`, changeFrequency: "monthly" },
    ...indexable.map((topic) => ({
      url: `${brand.siteUrl}/topic/${topic.slug}`,
      lastModified: topic.lastVerifiedAt ?? topic.updatedAt,
      changeFrequency: "hourly" as const,
    })),
  ];
}
