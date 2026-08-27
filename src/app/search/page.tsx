import type { Metadata } from "next";
import Link from "next/link";
import { SearchFollow } from "@/components/search-follow";
import { SearchForm } from "@/components/search-form";
import { currentProfile } from "@/lib/auth/current-user";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { topicKind } from "@/lib/compiler/taxonomy";
import { formatRelative, onPulse } from "@/lib/render/topic-view";
import { getGraph } from "@/lib/store/json-store";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

function scoreTopic(query: string, topic: { name: string; slug: string; aliases: string[]; description: string }): number {
  const q = query.toLowerCase();
  if (!q) return 0;
  if (topic.slug === q || topic.name.toLowerCase() === q) return 100;
  if (topic.slug.startsWith(q) || topic.name.toLowerCase().startsWith(q)) return 80;
  if (topic.aliases.some((alias) => alias.toLowerCase() === q)) return 70;
  if (topic.slug.includes(q) || topic.name.toLowerCase().includes(q)) return 50;
  if (topic.aliases.some((alias) => alias.toLowerCase().includes(q))) return 40;
  if (topic.description.toLowerCase().includes(q)) return 20;
  return 0;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const graph = await getGraph();
  const current = await currentProfile();
  const followed = new Set(current?.profile.follows.map((row) => row.topicId) ?? []);
  const now = new Date();
  const hits = q
    ? graph.topics
        .filter((topic) => isPublicTopicStatus(topic.status))
        .map((topic) => ({ topic, score: scoreTopic(q, topic) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.topic.name.localeCompare(b.topic.name))
        .slice(0, 24)
    : [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="display">Search</h1>
        <p className="text-[0.9375rem] leading-6">Find a Topic. Follow it. It enters your Frequency.</p>
      </header>
      <SearchForm query={q} />
      {q && hits.length === 0 ? (
        <p className="text-[0.9375rem] leading-6 text-ink-quiet">Nothing matches that yet.</p>
      ) : (
        <ul>
          {hits.map(({ topic }) => (
            <li key={topic.slug} className="flex items-baseline justify-between gap-3 border-t border-rule py-3 first:border-t-0">
              <div className="min-w-0">
                <Link href={`/topic/${topic.slug}`} className="font-heading text-[1.125rem] leading-6 hover:underline">
                  {topic.name}
                </Link>
                <p className="meta mt-1">
                  {topicKind(topic)}
                  {onPulse(topic)
                    ? ` · Updated ${formatRelative(topic.lastMaterialChangeAt, now)}`
                    : ""}
                </p>
              </div>
              {current ? <SearchFollow slug={topic.slug} following={followed.has(topic.id)} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
