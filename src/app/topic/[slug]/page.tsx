import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { TopicView } from "@/components/topic-view";
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
    <div className="space-y-6">
      {graph.topic.status !== "strong" ? (
        <p className="border border-border px-3 py-2 text-sm">
          This topic is {graph.topic.status} and is not indexed.
        </p>
      ) : null}
      <TopicView graph={graph} />
      <p className="text-sm text-muted-foreground">
        <Link className="underline" href={`/topic/${graph.topic.slug}/md`}>
          Markdown
        </Link>
      </p>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(graph, brand.siteUrl)) }}
      />
    </div>
  );
}
