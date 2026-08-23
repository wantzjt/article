import Link from "next/link";
import { brand } from "@/lib/brand";
import { listPublishedBriefs, listTopics } from "@/lib/store/json-store";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const topics = await listTopics();
  const briefs = await listPublishedBriefs();
  const changed = topics.filter((topic) => topic.lastMaterialChangeAt);
  const strong = topics.filter((topic) => topic.status === "strong");

  return (
    <div className="space-y-12">
      <section className="max-w-2xl space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Explore</p>
        <h1 className="font-serif text-4xl tracking-tight">{brand.tagline}</h1>
        <p className="text-muted-foreground">
          {brand.productName} keeps a small set of canonical AI topics. Pages render claims that
          already exist in the evidence graph. Prose is not the source of truth.
        </p>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em]">Latest briefs</h2>
        <ul className="mt-4 space-y-4">
          {briefs.length === 0 ? (
            <li className="text-sm text-muted-foreground">No briefs yet.</li>
          ) : (
            briefs.map((brief) => (
              <li key={brief.id}>
                <Link href={`/topic/${brief.topicSlug}`} className="font-serif text-2xl hover:underline">
                  {brief.headline}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {brief.topicName} · {brief.publishedAt.slice(0, 10)}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em]">Recently changed</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {(changed.length ? changed : strong).map((topic) => (
            <li key={topic.id} className="border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/topic/${topic.slug}`} className="font-medium hover:underline">
                  {topic.name}
                </Link>
                <Badge variant="outline">{topic.status}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{topic.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em]">All topics</h2>
        <ul className="mt-4 columns-2 gap-x-8 text-sm sm:columns-3">
          {topics.map((topic) => (
            <li key={topic.id} className="mb-2 break-inside-avoid">
              <Link href={`/topic/${topic.slug}`} className="hover:underline">
                {topic.name}
              </Link>
              {topic.status === "stub" ? (
                <span className="ml-2 text-xs text-muted-foreground">stub</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
