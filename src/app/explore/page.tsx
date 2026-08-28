import type { Metadata } from "next";
import Link from "next/link";
import { WorldFeed, type WorldFeedRow } from "@/components/world-feed";
import { currentProfile } from "@/lib/auth/current-user";
import { changeKindLabel, latestChangeByTopic } from "@/lib/compiler/change-engine";
import { neighborTopicIds } from "@/lib/compiler/graph-edges";
import { compileBlocked } from "@/lib/compiler/compile-priority";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { topicKind } from "@/lib/compiler/taxonomy";
import { brand } from "@/lib/brand";
import { changeLine, changeTimestamp, HOME_LEAD, moreChangesForTopic, movedToday, onPulse, pulseTopics, supportingLine } from "@/lib/render/topic-view";
import { getGraph } from "@/lib/store/json-store";
import type { TopicRecord } from "@/lib/compiler/types";

export const metadata: Metadata = { title: "Explore" };
export const dynamic = "force-dynamic";

function groupOf(topic: TopicRecord): string | null {
  const kind = topicKind(topic);
  const blob = `${topic.name} ${topic.description}`.toLowerCase();
  if (kind === "person") return "People";
  if (kind === "policy" || kind === "standard") return "Policy";
  if (kind === "model") return "Models";
  if (kind === "company") return "Companies";
  if (/\brobot|humanoid\b/.test(blob) || topic.slug === "robotics") return "Robotics";
  if (kind === "product" || kind === "concept") return "Technology";
  return null;
}

export default async function ExplorePage() {
  const graph = await getGraph();
  const now = new Date();
  const current = await currentProfile();
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
  const publicTopics = graph.topics.filter(
    (topic) => isPublicTopicStatus(topic.status) && !compileBlocked(topic.slug),
  );
  const pulse = pulseTopics(
    [...publicTopics]
      .filter(onPulse)
      .sort((a, b) => (b.lastMaterialChangeAt ?? "").localeCompare(a.lastMaterialChangeAt ?? "")),
  );
  const events = latestChangeByTopic(graph.changes ?? []);
  const catalog = publicTopics.map((topic) => ({ slug: topic.slug, name: topic.name }));
  const changeEventsByTopic = new Map<string, number>();
  for (const event of graph.changes ?? []) {
    changeEventsByTopic.set(event.topicId, (changeEventsByTopic.get(event.topicId) ?? 0) + 1);
  }
  const rows: WorldFeedRow[] = pulse.visible.map((row) => {
    const event = events.get(row.id);
    const raw = event?.summary || latestByTopic.get(row.id)?.changeSummary || "";
    const change = changeLine({
      briefHeadline: latestBriefByTopic.get(row.id)?.headline,
      changeSummary: raw,
    });
    const briefClaims = graph.briefs.find((brief) => brief.topicId === row.id && brief.status === "published")?.renderData.claimIds.length ?? 0;
    const changedAt = changeTimestamp(event?.createdAt, row.lastMaterialChangeAt);
    return {
      slug: row.slug,
      name: row.name,
      kind: topicKind(row),
      lastMaterialChangeAt: changedAt,
      change,
      support: supportingLine(raw, change),
      worldMoved: movedToday(changedAt, now),
      changeKind: event ? changeKindLabel(event.kind) : null,
      moreCount: moreChangesForTopic({
        changeEventCount: changeEventsByTopic.get(row.id) ?? 0,
        briefClaimCount: briefClaims,
        summary: event?.summary || latestByTopic.get(row.id)?.changeSummary || latestBriefByTopic.get(row.id)?.headline || "",
      }),
    };
  });

  const followed = new Set(current?.profile.follows.map((row) => row.topicId) ?? []);
  const relatedIds = new Set<string>();
  for (const id of followed) {
    for (const neighbor of neighborTopicIds(graph.edges ?? [], id)) {
      if (!followed.has(neighbor)) relatedIds.add(neighbor);
    }
  }
  const related = publicTopics.filter((topic) => relatedIds.has(topic.id)).slice(0, 8);

  const groups: Array<{ title: string; topics: TopicRecord[] }> = [
    { title: "Companies", topics: [] },
    { title: "Models", topics: [] },
    { title: "People", topics: [] },
    { title: "Policy", topics: [] },
    { title: "Robotics", topics: [] },
    { title: "Technology", topics: [] },
  ];
  for (const topic of publicTopics) {
    if (topic.status === "stub" && !topic.lastMaterialChangeAt) continue;
    const title = groupOf(topic);
    const group = groups.find((row) => row.title === title);
    if (group && group.topics.length < 10) group.topics.push(topic);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="display">Explore</h1>
        <p className="text-[0.9375rem] leading-6">
          Explore Topics {brand.productName} is tracking. Open one to see what changed and the evidence behind it.
        </p>
        <p className="meta">{brand.coverageNote}</p>
      </header>
      <section>
        <h2 className="kicker">Moving now</h2>
        <WorldFeed rows={rows.slice(0, HOME_LEAD)} orderKey="world" personalized={false} now={now} topics={catalog} />
      </section>
      {related.length > 0 ? (
        <section>
          <h2 className="kicker">Related to your Frequency</h2>
          <ul className="mt-3">
            {related.map((topic) => (
              <li key={topic.slug} className="border-t border-rule py-2 first:border-t-0">
                <Link href={`/topic/${topic.slug}`} className="font-heading text-[1.0625rem] leading-6 hover:underline">
                  {topic.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {groups
        .filter((group) => group.topics.length > 0)
        .map((group) => (
          <section key={group.title}>
            <h2 className="kicker">{group.title}</h2>
            <ul className="mt-3">
              {group.topics.map((topic) => (
                <li key={topic.slug} className="border-t border-rule py-2 first:border-t-0">
                  <Link href={`/topic/${topic.slug}`} className="text-[0.9375rem] leading-6 hover:underline">
                    {topic.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
