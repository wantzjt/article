import Link from "next/link";
import { WorldFeed, type WorldFeedRow } from "@/components/world-feed";
import { currentProfile } from "@/lib/auth/current-user";
import { changeKindLabel } from "@/lib/compiler/change-engine";
import { topicKind } from "@/lib/compiler/taxonomy";
import { loadClassifications } from "@/lib/frequency/classify";
import { changeCopy } from "@/lib/frequency/changes";
import { buildFrequency } from "@/lib/frequency/engine";
import { hasFollows } from "@/lib/frequency/rank";
import {
  changeLine,
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
    : pulseTopics([...graph.topics].filter(onPulse).sort((a, b) => (b.lastMaterialChangeAt ?? "").localeCompare(a.lastMaterialChangeAt ?? "")));

  const rows: WorldFeedRow[] = pulse.visible.map((row) => {
    const lastMaterial = "lastMaterialChangeAt" in row ? row.lastMaterialChangeAt : null;
    const change =
      "facet" in row
        ? changeCopy(row)
        : changeLine({
            briefHeadline: latestBriefByTopic.get(row.id)?.headline,
            changeSummary: latestByTopic.get(row.id)?.changeSummary,
          });
    return {
      slug: row.slug,
      name: row.name,
      kind: "kind" in row && typeof row.kind === "string" ? row.kind : topicKind(row),
      child: "facetChild" in row ? row.facetChild : null,
      lastMaterialChangeAt: lastMaterial,
      change,
      breakthrough: "breakthrough" in row && row.breakthrough,
      worldMoved: movedToday(lastMaterial, now),
      changeKind: "changeKind" in row && row.changeKind ? changeKindLabel(row.changeKind) : null,
    };
  });

  return (
    <div className="space-y-10">
      {frequencyOn ? (
        <section className="space-y-3">
          {params.welcome === "1" ? (
            <p className="text-[0.9375rem] leading-6">Your Frequency is live.</p>
          ) : null}
          <p className="kicker">Your Frequency</p>
          <p className="text-[0.9375rem] leading-6">
            The World, tuned around what you follow. A restream means your Frequency updated. A mark
            means the world changed.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          <p className="kicker">The World</p>
          <h1 className="display">Tune the news around you.</h1>
          <p className="text-[0.9375rem] leading-6">What changed. Why it matters. Where it came from.</p>
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
        {!frequencyOn ? <h2 className="kicker">What moved</h2> : null}
        <WorldFeed
          rows={rows}
          rest={pulse.rest.map((row) => ({ slug: row.slug, name: row.name }))}
          orderKey={payload?.orderKey ?? "world"}
          personalized={frequencyOn}
          now={now}
        />
      </section>
    </div>
  );
}
