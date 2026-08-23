import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brand } from "@/lib/brand";
import { TopicView } from "@/components/topic-view";
import { playMeta } from "@/lib/audio/brief";
import { jsonLd, robotsForStatus } from "@/lib/render/topic-view";
import { getTopicBySlug } from "@/lib/store/json-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const graph = await getTopicBySlug(slug);
  if (!graph) return { title: "Not found" };
  const robots = robotsForStatus(graph.topic.status);
  return {
    title: graph.topic.name,
    description: graph.topic.description,
    robots,
    alternates: { canonical: `${brand.siteUrl}/topic/${graph.topic.slug}` },
  };
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const graph = await getTopicBySlug(slug);
  if (!graph) notFound();

  return (
    <>
      <TopicView graph={graph} play={playMeta(graph)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(graph, brand.siteUrl)) }}
      />
    </>
  );
}
