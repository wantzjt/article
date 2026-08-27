import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/auth/current-user";
import { SendFrequencyButton } from "@/components/send-frequency-button";
import { loadClassifications } from "@/lib/frequency/classify";
import { changeCopy } from "@/lib/frequency/changes";
import { renderProfileMorning } from "@/lib/frequency/morning";
import { getGraph } from "@/lib/store/json-store";

export const metadata: Metadata = { title: "Morning Frequency" };
export const dynamic = "force-dynamic";

export default async function FrequencyPreviewPage() {
  const current = await currentProfile();
  if (!current) redirect("/signin?next=/frequency/preview");
  const graph = await getGraph();
  const classifications = await loadClassifications(graph);
  const morning = renderProfileMorning(graph, current.profile, new Date(), classifications);
  const rows = morning.rows;
  const html = morning.html;

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="kicker">Daily</p>
        <h1 className="display">Your Morning Frequency</h1>
        <p className="text-[0.9375rem] leading-6">
          5–8 important changes from the Topics you follow.
        </p>
        <SendFrequencyButton />
      </header>
      {rows.length === 0 ? (
        <p className="text-[0.9375rem] leading-6 text-ink-quiet">Follow topics to fill this brief.</p>
      ) : (
        <ol className="space-y-4">
          {rows.map((row) => (
            <li key={row.topicId} className="border-t border-rule pt-3">
              <Link href={`/topic/${row.slug}#what-changed`} className="font-serif text-[1.0625rem] leading-6 hover:underline">
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
