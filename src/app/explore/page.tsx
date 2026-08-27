import type { Metadata } from "next";
import { WorldFeed, type WorldFeedRow } from "@/components/world-feed";
import { topicKind } from "@/lib/compiler/taxonomy";
import { changeLine, movedToday, onPulse, pulseTopics } from "@/lib/render/topic-view";
import { getGraph } from "@/lib/store/json-store";

export const metadata: Metadata = { title: "Explore" };
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const graph = await getGraph();
  const now = new Date();
  const latestByTopic = new Map<string, { createdAt: string; changeSummary: string }>();
  for (const version of graph.versions) {
    const prev = latestByTopic.get(version.topicId);
    if (!prev || version.createdAt > prev.createdAt) {
      latestByTopic.set(version.topicId, {
        createdAt: version.createdAt,
        changeSummary: version.changeSummary,
      });
    }
  }
  const latestBriefByTopic = new Map<string, { publishedAt: string; headline: string }>();
  for (const brief of graph.briefs) {
    if (brief.status !== "published") continue;
    const prev = latestBriefByTopic.get(brief.topicId);
    if (!prev || brief.publishedAt > prev.publishedAt) {
      latestBriefByTopic.set(brief.topicId, {
        publishedAt: brief.publishedAt,
        headline: brief.headline,
      });
    }
  }
  const pulse = pulseTopics(
    [...graph.topics]
      .filter(onPulse)
      .sort((a, b) => (b.lastMaterialChangeAt ?? "").localeCompare(a.lastMaterialChangeAt ?? "")),
  );
  const rows: WorldFeedRow[] = pulse.visible.map((row) => ({
    slug: row.slug,
    name: row.name,
    kind: topicKind(row),
    lastMaterialChangeAt: row.lastMaterialChangeAt,
    change: changeLine({
      briefHeadline: latestBriefByTopic.get(row.id)?.headline,
      changeSummary: latestByTopic.get(row.id)?.changeSummary,
    }),
    worldMoved: movedToday(row.lastMaterialChangeAt, now),
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="kicker">The World</p>
        <h1 className="display">What moved</h1>
        <p className="text-[0.9375rem] leading-6">Shared evidence. Not your Frequency.</p>
      </header>
      <WorldFeed rows={rows} rest={pulse.rest.map((row) => ({ slug: row.slug, name: row.name }))} orderKey="world" personalized={false} now={now} />
    </div>
  );
}
