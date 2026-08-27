import Link from "next/link";
import { FrequencyList } from "@/components/frequency-list";
import { StatusChip } from "@/components/status-chip";
import { currentProfile } from "@/lib/auth/current-user";
import { topicKind } from "@/lib/compiler/taxonomy";
import { loadClassifications } from "@/lib/frequency/classify";
import { changeCopy } from "@/lib/frequency/changes";
import { buildFrequency } from "@/lib/frequency/engine";
import { hasFollows } from "@/lib/frequency/rank";
import {
  changeLine,
  formatCount,
  formatRelative,
  formatTime,
  movedToday,
  onPulse,
  pulseTopics,
  radarTopics,
  topicIndex,
  warehouseCoverage,
} from "@/lib/render/topic-view";
import { getGraph } from "@/lib/store/json-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const graph = await getGraph();
  const now = new Date();
  const moved = [...graph.topics]
    .filter(onPulse)
    .sort((a, b) => (b.lastMaterialChangeAt ?? "").localeCompare(a.lastMaterialChangeAt ?? ""));
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
    : pulseTopics(moved);
  const radar = radarTopics(graph, now);
  const coverage = warehouseCoverage(graph);
  const index = topicIndex(graph);

  const claimCount = graph.claims.filter((claim) => claim.status !== "rejected").length;

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="kicker">Explore</p>
        <p className="text-[0.9375rem] leading-6">
          Article.fm is an evidence graph for living topics — bills, models, companies — not a stream
          of rewritten articles.
        </p>
        <p className="text-[0.9375rem] leading-6">
          Claims come before prose. A public sentence has to sit on a persisted claim, and a claim has
          to sit on a source.
        </p>
        <p className="text-[0.9375rem] leading-6">
          Pulse is what moved. Open a topic for evidence, disagreements, and timeline.
        </p>
        <p className="text-[0.9375rem] leading-6">
          If a topic is still a stub, sources are banked and not compiled: five latest, the rest under
          a lid.
        </p>
        <p className="text-[0.9375rem] leading-6">
          This is not a content mill. We do not invent journalists, average away disputes, or rewrite
          the page on every visit.
        </p>
        <p className="meta">
          {formatCount(claimCount)} claims
          {" · "}
          {formatCount(coverage.urls)} sources
          {" · last retrieved "}
          {formatTime(coverage.lastRetrievedAt)}
        </p>
      </section>

      <section>
        <h2 className="kicker">{frequencyOn ? "Your Frequency" : "The world"}</h2>
        {frequencyOn ? (
          <p className="meta mt-2">
            A projection of the shared graph. The signal mark means the world moved. A restream means
            your Frequency reordered.
          </p>
        ) : null}
        {pulse.visible.length === 0 ? (
          <p className="mt-4 text-[0.9375rem] leading-6 text-ink-quiet">
            {frequencyOn
              ? "Follow topics to build a Frequency. Mute is the only hard exclude."
              : "No material changes in the recent window."}
          </p>
        ) : (
          <FrequencyList orderKey={payload?.orderKey ?? "world"}>
            <ul className="mt-4">
              {pulse.visible.map((row) => {
                const slug = row.slug;
                const name = row.name;
                const status = row.status;
                const lastMaterial = "lastMaterialChangeAt" in row ? row.lastMaterialChangeAt : null;
                const lastVerified = "lastVerifiedAt" in row ? row.lastVerifiedAt : null;
                const kind = "kind" in row && typeof row.kind === "string" ? row.kind : topicKind(row);
                const change =
                  "facet" in row
                    ? changeCopy(row)
                    : changeLine({
                        briefHeadline: latestBriefByTopic.get(row.id)?.headline,
                        changeSummary: latestByTopic.get(row.id)?.changeSummary,
                      });
                const today = movedToday(lastMaterial, now);
                const breakthrough = "breakthrough" in row && row.breakthrough;
                const child = "facetChild" in row ? row.facetChild : null;
                return (
                  <li
                    key={slug}
                    data-frequency-slug={slug}
                    className={`border-t border-rule py-3 first:border-t-0 pl-3 ${today ? "border-l-2 border-l-signal" : "border-l-2 border-l-rule"}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/topic/${slug}#what-changed`}
                        className="font-serif text-[1.0625rem] leading-6 tracking-tight text-ink hover:underline"
                      >
                        {name}
                      </Link>
                      <StatusChip status={status} />
                    </div>
                    <p className="meta mt-1">
                      {kind}
                      {child ? ` · ${child}` : ""}
                      {today ? " · world moved" : ""}
                      {breakthrough ? " · material interrupt" : ""}
                    </p>
                    <p className="mt-1 flex gap-2 text-[0.9375rem] leading-6 text-ink">
                      <span
                        className={`mt-[0.55rem] size-1.5 shrink-0 rounded-full ${today ? "bg-signal" : "bg-rule"}`}
                        aria-hidden
                      />
                      <span>{change}</span>
                    </p>
                    <p className="meta mt-1">Verified {formatTime(lastVerified)}</p>
                  </li>
                );
              })}
            </ul>
          </FrequencyList>
        )}
        {pulse.rest.length > 0 ? (
          <details className="sources mt-2">
            <summary>More movement ({pulse.rest.length})</summary>
            <ul className="mt-1 pb-3">
              {pulse.rest.map((row) => (
                <li key={row.slug} className="border-t border-rule py-2 first:border-t-0">
                  <Link href={`/topic/${row.slug}#what-changed`} className="text-[0.8125rem] leading-5 hover:underline">
                    {row.name}
                  </Link>
                  <span className="meta ml-2">{"kind" in row && typeof row.kind === "string" ? row.kind : topicKind(row)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section>
        <h2 className="kicker">Radar</h2>
        {radar.length === 0 ? (
          <p className="mt-4 text-[0.9375rem] leading-6 text-ink-quiet">No banked sources yet.</p>
        ) : (
          <ul className="mt-4">
            {radar.map((row) => (
              <li key={row.slug} className="border-t border-rule py-3 first:border-t-0">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/topic/${row.slug}`}
                    className="font-serif text-[1.0625rem] leading-6 tracking-tight text-ink hover:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="meta shrink-0">{row.kind}</span>
                </div>
                <p className="meta mt-1">
                  {formatCount(row.sourceCount)} sources
                  {" · updated "}
                  {formatRelative(row.lastRetrievedAt, now)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="kicker">Index</h2>
        <details className="sources mt-2">
          <summary>
            {formatCount(coverage.topics)} topics
            {coverage.people ? ` · ${coverage.people} people` : ""}
            {" · "}
            {formatCount(coverage.urls)} sources
          </summary>
          <div className="mt-3 space-y-4 pb-3">
            {index.map((group) => (
              <div key={group.kind}>
                <p className="kicker">{group.kind}</p>
                <ul className="mt-1">
                  {group.topics.map((topic) => (
                    <li key={topic.slug} className="py-0.5">
                      <Link
                        href={`/topic/${topic.slug}`}
                        className={`text-[0.8125rem] leading-5 hover:underline ${topic.status === "stub" ? "text-ink-quiet" : "text-ink"}`}
                      >
                        {topic.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}
