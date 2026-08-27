import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/magic-link";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await currentUser();
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  if (user) redirect(nextPath);

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="kicker">Your Frequency</p>
        <h1 className="display">Sign in</h1>
        <p className="text-[0.9375rem] leading-6">
          Email a link. No password. Your Frequency comes with you.
        </p>
      </header>
      {params.error === "expired" ? (
        <p className="text-[0.9375rem] leading-6 text-status-disputed">That link expired. Request another.</p>
      ) : null}
      <SignInForm nextPath={nextPath} />
    </article>
  );
}
