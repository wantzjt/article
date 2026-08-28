import { changeKindLabel, latestChangeByTopic } from "@/lib/compiler/change-engine";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { topicKind } from "@/lib/compiler/taxonomy";
import { areaTitle, newspaperAreaForTopic } from "@/lib/frequency/interests";
import { changeCopy } from "@/lib/frequency/changes";
import type { RankedChange } from "@/lib/frequency/rank";
import type { GraphSnapshot } from "@/lib/store/graph";
import type { WorldFeedRow } from "@/components/world-feed";
import {
  changeLine,
  changeTimestamp,
  isRecentActivity,
  moreChangesForTopic,
  movedToday,
  supportingLine,
} from "./topic-view";

const SECTION_CAP = 3;
const NEWSPAPER_AREAS = ["technology", "business", "policy", "people"] as const;

export function toWorldFeedRows(
  graph: GraphSnapshot,
  items: Array<{
    slug: string;
    name: string;
    topicId: string;
    kind?: string;
    lastMaterialChangeAt: string | null;
    facetChild?: string | null;
    breakthrough?: boolean;
    reasons?: string[];
    changeKind?: string | null;
    headline?: string;
    changeSummary?: string;
  }>,
  now: Date,
): WorldFeedRow[] {
  const events = latestChangeByTopic(graph.changes ?? []);
  const latestByTopic = new Map<string, { createdAt: string; changeSummary: string }>();
  for (const version of graph.versions) {
    const prev = latestByTopic.get(version.topicId);
    if (!prev || version.createdAt > prev.createdAt) {
      latestByTopic.set(version.topicId, { createdAt: version.createdAt, changeSummary: version.changeSummary });
    }
  }
  const latestBriefByTopic = new Map<string, { publishedAt: string; headline: string }>();
  for (const brief of graph.briefs) {
    if (brief.status !== "published") continue;
    const prev = latestBriefByTopic.get(brief.topicId);
    if (!prev || brief.publishedAt > prev.publishedAt) {
      latestBriefByTopic.set(brief.topicId, { publishedAt: brief.publishedAt, headline: brief.headline });
    }
  }
  const changeEventsByTopic = new Map<string, number>();
  for (const event of graph.changes ?? []) {
    changeEventsByTopic.set(event.topicId, (changeEventsByTopic.get(event.topicId) ?? 0) + 1);
  }
  return items.map((row) => {
    const event = events.get(row.topicId);
    const changedAt = changeTimestamp(event?.createdAt, row.lastMaterialChangeAt);
    const ranked = "reasons" in row && Array.isArray(row.reasons);
    const raw = event?.summary || latestByTopic.get(row.topicId)?.changeSummary || row.changeSummary || "";
    const change = changeLine({
      briefHeadline: ranked ? changeCopy({ headline: row.headline ?? "", changeSummary: row.changeSummary ?? "" }) : latestBriefByTopic.get(row.topicId)?.headline,
      changeSummary: raw,
    });
    const briefClaims =
      graph.briefs.find((brief) => brief.topicId === row.topicId && brief.status === "published")?.renderData.claimIds.length ?? 0;
    return {
      slug: row.slug,
      name: row.name,
      kind: row.kind ?? topicKind(graph.topics.find((topic) => topic.id === row.topicId) ?? { entityType: "company" }),
      child: row.facetChild ?? null,
      lastMaterialChangeAt: changedAt,
      change,
      support: supportingLine(raw, change),
      breakthrough: row.breakthrough,
      worldMoved: movedToday(changedAt, now),
      changeKind: event ? changeKindLabel(event.kind) : row.changeKind ? changeKindLabel(row.changeKind) : null,
      moreCount: moreChangesForTopic({
        changeEventCount: changeEventsByTopic.get(row.topicId) ?? 0,
        briefClaimCount: briefClaims,
        summary: event?.summary || latestByTopic.get(row.topicId)?.changeSummary || "",
      }),
    };
  });
}

export function newspaperSections(input: {
  graph: GraphSnapshot;
  now: Date;
  ranked?: RankedChange[];
  exclude: Set<string>;
  interestOrder?: string[];
}): Array<{ id: string; title: string; rows: WorldFeedRow[] }> {
  const { graph, now, ranked, interestOrder = [] } = input;
  const publicTopics = graph.topics.filter((topic) => isPublicTopicStatus(topic.status));
  const order = [
    ...interestOrder.filter((id) => NEWSPAPER_AREAS.includes(id as (typeof NEWSPAPER_AREAS)[number])),
    ...NEWSPAPER_AREAS.filter((id) => !interestOrder.includes(id)),
  ];
  const pool: Array<{
    slug: string;
    name: string;
    topicId: string;
    kind: string;
    lastMaterialChangeAt: string | null;
    facetChild?: string | null;
    changeKind?: string | null;
    headline?: string;
    changeSummary?: string;
    breakthrough?: boolean;
  }> = ranked
    ? ranked.map((row) => ({
        slug: row.slug,
        name: row.name,
        topicId: row.topicId,
        kind: row.kind,
        lastMaterialChangeAt: row.lastMaterialChangeAt,
        facetChild: row.facetChild,
        changeKind: row.changeKind,
        headline: row.headline,
        changeSummary: row.changeSummary,
        breakthrough: row.breakthrough,
      }))
    : publicTopics
        .filter((topic) => topic.lastMaterialChangeAt)
        .sort((a, b) => (b.lastMaterialChangeAt ?? "").localeCompare(a.lastMaterialChangeAt ?? ""))
        .map((topic) => ({
          slug: topic.slug,
          name: topic.name,
          topicId: topic.id,
          kind: topicKind(topic),
          lastMaterialChangeAt: topic.lastMaterialChangeAt,
        }));

  const sections: Array<{ id: string; title: string; rows: WorldFeedRow[] }> = [];
  for (const area of order) {
    const items = pool.filter((row) => {
      if (!isRecentActivity(row.lastMaterialChangeAt, now)) return false;
      return newspaperAreaForTopic({ slug: row.slug, kind: row.kind, child: row.facetChild }) === area;
    });
    if (items.length === 0) continue;
    sections.push({
      id: area,
      title: areaTitle(area),
      rows: toWorldFeedRows(graph, items.slice(0, SECTION_CAP), now),
    });
  }
  return sections;
}
