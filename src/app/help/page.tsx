import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="kicker">Desk</p>
        <h1 className="display">Help</h1>
      </header>
      <section className="space-y-3 border-t border-rule pt-6">
        <p>
          <strong>The World</strong> is what moved, shared. <strong>Your Frequency</strong> is the same
          graph, ranked for the Topics you follow.
        </p>
        <p>
          <Link href="/explore" className="underline decoration-rule underline-offset-2">Explore</Link>{" "}
          finds Topics.{" "}
          <Link href="/search" className="underline decoration-rule underline-offset-2">Search</Link>{" "}
          finds a specific one. Open a Topic to read what changed and the evidence. Click a claim to
          see its sources or ask about it.
        </p>
        <p>
          <Link href="/frequency/preview" className="underline decoration-rule underline-offset-2">
            Morning Frequency
          </Link>{" "}
          is the daily email of that same ranking.
        </p>
        <p className="meta">{brand.coverageNote}</p>
      </section>
      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">Contact</h2>
        <p>
          <a className="underline decoration-rule underline-offset-2" href={`mailto:${brand.correctionsEmail}`}>
            {brand.correctionsEmail}
          </a>
        </p>
      </section>
    </article>
  );
}
