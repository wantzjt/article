import Link from "next/link";
import { FrequencyBoard } from "@/components/frequency-board";
import { WorldFeed, type WorldFeedRow } from "@/components/world-feed";
import { currentProfile } from "@/lib/auth/current-user";
import { changeKindLabel, latestChangeByTopic } from "@/lib/compiler/change-engine";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { topicKind } from "@/lib/compiler/taxonomy";
import { loadClassifications } from "@/lib/frequency/classify";
import { changeCopy } from "@/lib/frequency/changes";
import { buildFrequency } from "@/lib/frequency/engine";
import { explainWhy, frequencyRows } from "@/lib/frequency/explain";
import { hasFollows } from "@/lib/frequency/rank";
import { brand } from "@/lib/brand";
import { newspaperSections } from "@/lib/render/newspaper";
import {
  changeLine,
  changeTimestamp,
  moreChangesForTopic,
  movedToday,
  onPulse,
  pulseTopics,
} from "@/lib/render/topic-view";
import { getGraph } from "@/lib/store/json-store";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const graph = await getGraph();
  const now = new Date();
  const params = await searchParams;
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
  const current = await currentProfile();
  const frequencyOn = hasFollows(current?.profile ?? null);
  const classifications = frequencyOn ? await loadClassifications(graph) : {};
  const payload =
    frequencyOn && current ? buildFrequency(graph, current.profile, classifications, now) : null;
  const pulse = payload
    ? { visible: payload.visible, rest: payload.rest }
    : pulseTopics(
        [...graph.topics]
          .filter(onPulse)
          .sort((a, b) => (b.lastMaterialChangeAt ?? "").localeCompare(a.lastMaterialChangeAt ?? "")),
      );

  const events = latestChangeByTopic(graph.changes ?? []);
  const changeEventsByTopic = new Map<string, number>();
  for (const event of graph.changes ?? []) {
    changeEventsByTopic.set(event.topicId, (changeEventsByTopic.get(event.topicId) ?? 0) + 1);
  }
  const catalog = graph.topics
    .filter((topic) => isPublicTopicStatus(topic.status))
    .map((topic) => ({ slug: topic.slug, name: topic.name }));
  const names = new Map(graph.topics.map((topic) => [topic.id, { slug: topic.slug, name: topic.name }]));
  const rows: WorldFeedRow[] = pulse.visible.map((row) => {
    const lastMaterial = "lastMaterialChangeAt" in row ? row.lastMaterialChangeAt : null;
    const topicId = "topicId" in row ? row.topicId : "id" in row ? row.id : "";
    const event = events.get(topicId);
    const ranked = "reasons" in row ? row : null;
    const change = changeLine({
      briefHeadline: "facet" in row ? changeCopy(row) : latestBriefByTopic.get(topicId)?.headline,
      changeSummary: event?.summary || latestByTopic.get(topicId)?.changeSummary,
    });
    const briefClaims =
      graph.briefs.find((brief) => brief.topicId === topicId && brief.status === "published")?.renderData.claimIds.length ?? 0;
    const changedAt = changeTimestamp(event?.createdAt, lastMaterial);
    return {
      slug: row.slug,
      name: row.name,
      kind: "kind" in row && typeof row.kind === "string" ? row.kind : topicKind(row),
      child: "facetChild" in row ? row.facetChild : null,
      lastMaterialChangeAt: changedAt,
      change,
      breakthrough: "breakthrough" in row && row.breakthrough,
      worldMoved: movedToday(changedAt, now),
      changeKind: event ? changeKindLabel(event.kind) : ranked?.changeKind ? changeKindLabel(ranked.changeKind) : null,
      why: ranked ? explainWhy(ranked) : null,
      moreCount: moreChangesForTopic({
        changeEventCount: changeEventsByTopic.get(topicId) ?? 0,
        briefClaimCount: briefClaims,
        summary: event?.summary || latestByTopic.get(topicId)?.changeSummary || "",
      }),
    };
  });

  const sections = newspaperSections({
    graph,
    now,
    ranked: payload?.ranked,
    exclude: new Set(rows.map((row) => row.slug)),
    interestOrder: Object.entries(current?.profile.interests ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id),
  });
  const welcome = params.welcome === "1";

  return (
    <div className={`space-y-10 ${welcome ? "welcome-in" : ""}`}>
      {frequencyOn && current ? (
        <section className="space-y-4">
          {welcome ? <p className="text-[0.9375rem] leading-6">Your Frequency is live.</p> : null}
          <h1 className="display">Your Frequency</h1>
          <p className="text-[0.9375rem] leading-6">Tuned to the Topics and signals you care about.</p>
          <FrequencyBoard rows={frequencyRows(current.profile, names)} />
        </section>
      ) : (
        <section className="space-y-4">
          <h1 className="display">Tune the news around you.</h1>
          <p className="text-[0.9375rem] leading-6">What changed. Why it matters. Where it came from.</p>
          <p className="meta">{brand.coverageNote}</p>
          <p>
            <Link
              href="/start"
              className="inline-flex min-h-11 items-center border-b border-ink font-mono text-[12px]/[16px] text-ink"
            >
              Build my Frequency
            </Link>
          </p>
        </section>
      )}

      <section>
        <h2 className="kicker">{frequencyOn ? "Now" : "The World"}</h2>
        <WorldFeed
          rows={rows}
          rest={pulse.rest.map((row) => ({ slug: row.slug, name: row.name }))}
          orderKey={payload?.orderKey ?? "world"}
          personalized={frequencyOn}
          now={now}
          topics={catalog}
        />
      </section>

      {sections.map((section) => (
        <section key={section.id}>
          <h2 className="kicker">{section.title}</h2>
          <WorldFeed
            rows={section.rows.map((row) => ({ ...row, why: null }))}
            orderKey={`${section.id}-paper`}
            personalized={false}
            now={now}
            topics={catalog}
          />
        </section>
      ))}
    </div>
  );
}
