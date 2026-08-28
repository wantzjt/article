import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="kicker">Desk</p>
        <h1 className="display">Privacy</h1>
      </header>
      <section className="space-y-3 border-t border-rule pt-6">
        <p>
          {brand.productName} stores a session cookie (<span className="font-mono text-[12px]">afm_session</span>)
          when you sign in, plus the Topics you follow and the weights you set. Magic-link email is
          used only to sign you in.
        </p>
        <p>We do not sell personal information. We do not run advertising trackers on these pages.</p>
        <p>
          Questions:{" "}
          <a className="underline decoration-rule underline-offset-2" href={`mailto:${brand.correctionsEmail}`}>
            {brand.correctionsEmail}
          </a>
          .
        </p>
      </section>
    </article>
  );
}
