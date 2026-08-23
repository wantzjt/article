import type { Metadata } from "next";

export const metadata: Metadata = { title: "Corrections" };

export default function CorrectionsPage() {
  return (
    <article className="max-w-2xl space-y-4 font-serif">
      <h1 className="text-3xl tracking-tight">Corrections</h1>
      <p>
        If a claim is wrong, the fix is to attach better evidence or mark the claim superseded. We
        do not silently rewrite history on the topic page.
      </p>
      <p>
        Email corrections with the topic URL, the claim text, and a primary source URL. Material
        changes create a new topic version.
      </p>
    </article>
  );
}
