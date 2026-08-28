import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="kicker">Desk</p>
        <h1 className="display">Terms</h1>
      </header>
      <section className="space-y-3 border-t border-rule pt-6">
        <p>
          {brand.productName} publishes tracked claims with sources. It is not legal, financial, or
          investment advice. You are responsible for how you use it.
        </p>
        <p>
          Evidence can be wrong. If it is, send a correction to{" "}
          <a className="underline decoration-rule underline-offset-2" href={`mailto:${brand.correctionsEmail}`}>
            {brand.correctionsEmail}
          </a>{" "}
          or use <Link href="/corrections" className="underline decoration-rule underline-offset-2">Corrections</Link>.
        </p>
        <p>We may change these terms. Continued use means you accept the current page.</p>
      </section>
    </article>
  );
}
