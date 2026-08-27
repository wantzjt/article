import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brand } from "@/lib/brand";
import { TopicView } from "@/components/topic-view";
import { playMeta } from "@/lib/audio/brief";
import { currentProfile } from "@/lib/auth/current-user";
import { compileBlocked } from "@/lib/compiler/compile-priority";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { jsonLd, robotsForStatus } from "@/lib/render/topic-view";
import { getTopicBySlug } from "@/lib/store/json-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const graph = await getTopicBySlug(slug);
  if (!graph || !isPublicTopicStatus(graph.topic.status)) return { title: "Not found" };
  const robots = robotsForStatus(graph.topic.status, graph.topic.slug);
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
  if (!graph || !isPublicTopicStatus(graph.topic.status)) notFound();
  const current = await currentProfile();
  const follow = current?.profile.follows.find((row) => row.topicId === graph.topic.id);

  return (
    <>
      <TopicView
        graph={graph}
        play={playMeta(graph)}
        frequency={
          compileBlocked(graph.topic.slug)
            ? undefined
            : {
                signedIn: Boolean(current),
                follow: follow ? { muted: follow.muted } : null,
                facets: current?.profile.facets[graph.topic.id] ?? {},
              }
        }
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(graph, brand.siteUrl)) }}
      />
    </>
  );
}
