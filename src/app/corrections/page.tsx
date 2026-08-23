import type { Metadata } from "next";

export const metadata: Metadata = { title: "Corrections" };

export default function CorrectionsPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="kicker">Desk</p>
        <h1 className="display">Corrections</h1>
      </header>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">What we change</h2>
        <p>
          If a claim is wrong, the fix is to attach better evidence or mark the claim superseded. We
          do not silently rewrite history on the topic page.
        </p>
      </section>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="kicker">How to send one</h2>
        <p>
          Email corrections with the topic URL, the claim text, and a primary source URL. Material
          changes create a new topic version.
        </p>
      </section>
    </article>
  );
}
