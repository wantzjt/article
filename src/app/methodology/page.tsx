import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Methodology" };

export default function MethodologyPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="kicker">Desk</p>
        <h1 className="display">Methodology</h1>
      </header>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">Claims before prose</h2>
        <p>
          {brand.productName} publishes topics, not rewritten articles. The compiler retrieves web
          evidence through Vercel AI Gateway Exa search, extracts atomic claims, verifies each claim
          against its excerpt, and only then renders prose.
        </p>
        <p>A public sentence is cut if it cannot be traced through a claim to a persisted source.</p>
      </section>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">Claim states</h2>
        <p>
          Claim states are supported, single-source, disputed, unresolved, superseded, or rejected.
          Disagreement is stored. It is not averaged away. Evidence is shown as independent sources
          and primary sources — never as a confidence percentage.
        </p>
      </section>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">Strong topics</h2>
        <p>
          Strong topics require at least five accepted claims, three publisher domains, one
          primary-ish source, and a non-empty change window. Everything else is noindex.
        </p>
      </section>
    </article>
  );
}
