import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="kicker">Desk</p>
        <h1 className="display">About</h1>
        <p className="text-[0.9375rem] leading-6">{brand.description}</p>
      </header>
      <section className="space-y-3 border-t border-rule pt-6">
        <p>
          {brand.productName} tracks what changed, why it matters to you, and where that came from.
          The World is shared. Your Frequency is personal. A Topic is a living dossier of claims
          and sources — not a rewritten article.
        </p>
        <p className="meta">{brand.coverageNote}</p>
      </section>
      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">Corrections</h2>
        <p>
          If a claim is wrong, write{" "}
          <a className="underline decoration-rule underline-offset-2" href={`mailto:${brand.correctionsEmail}`}>
            {brand.correctionsEmail}
          </a>
          . See <Link href="/corrections" className="underline decoration-rule underline-offset-2">Corrections</Link>.
        </p>
      </section>
    </article>
  );
}
