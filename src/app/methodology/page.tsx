import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Methodology" };

export default function MethodologyPage() {
  return (
    <article className="prose-article max-w-2xl space-y-4 font-serif">
      <h1 className="text-3xl tracking-tight">Methodology</h1>
      <p>
        {brand.productName} publishes topics, not rewritten articles. The compiler retrieves web
        evidence through Vercel AI Gateway Exa search, extracts atomic claims, verifies each claim
        against its excerpt, and only then renders prose.
      </p>
      <p>A public sentence is cut if it cannot be traced through a claim to a persisted source.</p>
      <p>
        Claim states are supported, single-source, disputed, unresolved, superseded, or rejected.
        Disagreement is stored. It is not averaged away.
      </p>
      <p>
        Strong topics require at least five accepted claims, three publisher domains, one primary-ish
        source, and a non-empty change window. Everything else is noindex.
      </p>
    </article>
  );
}
