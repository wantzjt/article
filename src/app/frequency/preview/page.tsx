import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/auth/current-user";
import { changesFromGraph, changeCopy } from "@/lib/frequency/changes";
import { morningRows, renderMorningFrequencyHtml, unsubscribeUrl } from "@/lib/frequency/email";
import { hasFollows, rankFrequency } from "@/lib/frequency/rank";
import { unsubTokenFor } from "@/lib/frequency/store";
import { getGraph } from "@/lib/store/json-store";

export const metadata: Metadata = { title: "Morning Frequency" };
export const dynamic = "force-dynamic";

export default async function FrequencyPreviewPage() {
  const current = await currentProfile();
  if (!current) redirect("/signin?next=/frequency/preview");
  const graph = await getGraph();
  const now = new Date();
  const ranked = hasFollows(current.profile)
    ? rankFrequency(changesFromGraph(graph, current.profile, now), current.profile, now)
    : [];
  const rows = morningRows(ranked);
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);
  const html = renderMorningFrequencyHtml({
    email: current.user.email,
    dateLabel,
    rows,
    unsubUrl: unsubscribeUrl(unsubTokenFor(current.user.id)),
  });

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="kicker">Your Frequency</p>
        <h1 className="display">Morning email</h1>
        <p className="text-[0.9375rem] leading-6">
          Same ranker as Explore. Not a second editorial pipeline.
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="text-[0.9375rem] leading-6 text-ink-quiet">Follow topics to fill this brief.</p>
      ) : (
        <ol className="space-y-4">
          {rows.map((row) => (
            <li key={row.topicId} className="border-t border-rule pt-3">
              <Link href={`/topic/${row.slug}`} className="font-serif text-[1.0625rem] leading-6 hover:underline">
                {row.name}
              </Link>
              <p className="meta mt-1">{row.breakthrough ? "material" : row.facet}</p>
              <p className="mt-1 text-[0.9375rem] leading-6">{changeCopy(row)}</p>
            </li>
          ))}
        </ol>
      )}
      <details className="sources">
        <summary>HTML</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap pb-3 font-mono text-[11px]/[16px] text-ink-quiet">
          {html}
        </pre>
      </details>
    </article>
  );
}
