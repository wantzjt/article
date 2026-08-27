import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { formatCount, formatTime, warehouseCoverage } from "@/lib/render/topic-view";
import { getGraph } from "@/lib/store/json-store";

export const metadata: Metadata = { title: "Methodology" };
export const dynamic = "force-dynamic";

export default async function MethodologyPage() {
  const graph = await getGraph();
  const coverage = warehouseCoverage(graph);
  const claimCount = graph.claims.filter((claim) => claim.status !== "rejected").length;

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="kicker">Desk</p>
        <h1 className="display">Methodology</h1>
        <p className="meta">
          Last retrieved {formatTime(coverage.lastRetrievedAt)}
          {" · "}
          {formatCount(claimCount)} claims
          {" · "}
          {formatCount(coverage.urls)} sources
          {" · "}
          {coverage.strong} strong
          {" · "}
          {coverage.provisional} provisional
        </p>
      </header>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">Claims before prose</h2>
        <p>
          {brand.productName} publishes topics, not rewritten articles. Evidence is retrieved, claims
          are extracted and checked against their excerpts, and only then does a sentence go on the
          page.
        </p>
        <p>A public sentence is cut if it cannot be traced through a claim to a persisted source.</p>
      </section>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">Claim states</h2>
        <p>
          Claim states are supported, single-source, disputed, unresolved, superseded, or rejected.
          Disagreement is stored. It is not averaged away. Evidence is independent sources and
          primary sources — never a confidence percentage.
        </p>
      </section>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">What is indexed</h2>
        <p>
          Strong topics need at least five accepted claims, three publisher domains, one primary
          source, and a change window. Stubs and provisionals stay in the warehouse and are noindex.
          Off-spine hubs are banked, not compiled, and not offered on Pulse.
        </p>
      </section>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">What this is not</h2>
        <p>
          This is not a content mill, not a personalized feed, and not a daily editorial desk. Pages
          are not rewritten on each visit. Follow, Frequency, and email are not on this site yet.
        </p>
      </section>
    </article>
  );
}
