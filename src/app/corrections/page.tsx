import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { formatCount, formatTime, warehouseCoverage } from "@/lib/render/topic-view";
import { getGraph } from "@/lib/store/json-store";

export const metadata: Metadata = { title: "Corrections" };
export const dynamic = "force-dynamic";

export default async function CorrectionsPage() {
  const graph = await getGraph();
  const coverage = warehouseCoverage(graph);
  const claimCount = graph.claims.filter((claim) => claim.status !== "rejected").length;

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="kicker">Desk</p>
        <h1 className="display">Corrections</h1>
        <p className="meta">
          Last retrieved {formatTime(coverage.lastRetrievedAt)}
          {" · "}
          {formatCount(claimCount)} claims
          {" · "}
          {formatCount(coverage.urls)} sources
          {" · no open corrections"}
        </p>
      </header>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">What we change</h2>
        <p>
          If a claim is wrong, the fix is to attach better evidence or mark the claim superseded. We
          do not silently rewrite the topic page. A material change creates a new topic version.
        </p>
      </section>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">How to send one</h2>
        <p>
          Email{" "}
          <a className="underline decoration-rule underline-offset-2" href={`mailto:${brand.correctionsEmail}`}>
            {brand.correctionsEmail}
          </a>{" "}
          with the topic URL, the claim text, and a primary source URL. We will not invent a
          journalist byline to stand in front of the evidence.
        </p>
      </section>
    </article>
  );
}
