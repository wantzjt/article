import Link from "next/link";
import { brand } from "@/lib/brand";
import { StatusChip } from "@/components/status-chip";
import { formatTime, oneLine } from "@/lib/render/topic-view";
import { getGraph } from "@/lib/store/json-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const graph = await getGraph();
  const topics = [...graph.topics].sort((a, b) =>
    (b.lastMaterialChangeAt ?? b.updatedAt).localeCompare(a.lastMaterialChangeAt ?? a.updatedAt),
  );
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
  const moved = topics.filter((topic) => topic.lastMaterialChangeAt);
  const briefs = graph.briefs
    .filter((brief) => brief.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <p className="kicker">Explore</p>
        <h1 className="display">{brand.tagline}</h1>
      </section>

      <section>
        <h2 className="kicker">What moved</h2>
        {moved.length === 0 ? (
          <p className="mt-4 text-[0.9375rem] leading-6 text-ink-quiet">
            No material changes in the recent window.
          </p>
        ) : (
          <ul className="mt-4">
            {moved.map((topic) => {
              const change =
                latestByTopic.get(topic.id)?.changeSummary ?? topic.description;
              return (
                <li key={topic.id} className="border-t border-rule py-3 first:border-t-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/topic/${topic.slug}`}
                      className="font-serif text-[1.0625rem] leading-6 tracking-tight text-ink hover:underline"
                    >
                      {topic.name}
                    </Link>
                    <StatusChip status={topic.status} />
                  </div>
                  <p className="mt-1 flex gap-2 text-[0.9375rem] leading-6 text-ink">
                    <span className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-signal" aria-hidden />
                    <span>{oneLine(change)}</span>
                  </p>
                  <p className="meta mt-1">Verified {formatTime(topic.lastVerifiedAt)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {briefs.length > 0 ? (
        <section>
          <h2 className="kicker">Latest briefs</h2>
          <ul className="mt-4">
            {briefs.map((brief) => {
              const topic = graph.topics.find((row) => row.id === brief.topicId);
              return (
                <li key={brief.id} className="border-t border-rule py-3 first:border-t-0">
                  <Link
                    href={`/topic/${topic?.slug ?? ""}`}
                    className="font-serif text-[1.0625rem] leading-6 tracking-tight hover:underline"
                  >
                    {brief.headline}
                  </Link>
                  <p className="meta mt-1">
                    {topic?.name ?? "Topic"}
                    {" · "}
                    {brief.publishedAt.slice(0, 10)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="kicker">All topics</h2>
        <ul className="mt-4">
          {topics.map((topic) => {
            const stub = topic.status === "stub";
            return (
              <li
                key={topic.id}
                className={`flex items-baseline justify-between gap-3 border-t border-rule py-1.5 first:border-t-0 ${stub ? "text-ink-quiet" : ""}`}
              >
                <Link
                  href={`/topic/${topic.slug}`}
                  className={`text-[0.8125rem] leading-5 hover:underline ${stub ? "" : "text-ink"}`}
                >
                  {topic.name}
                </Link>
                {stub || topic.status === "provisional" ? (
                  <StatusChip status={topic.status} />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
