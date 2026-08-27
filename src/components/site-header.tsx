import Link from "next/link";
import { brand } from "@/lib/brand";
import { currentProfile, currentUser } from "@/lib/auth/current-user";
import { hasFollows } from "@/lib/frequency/rank";

export async function SiteHeader() {
  const user = await currentUser();
  const current = user ? await currentProfile() : null;
  const frequencyHref = hasFollows(current?.profile ?? null) ? "/" : "/start";
  const emailHref = user ? "/frequency/preview" : "/signin?next=/frequency/preview";
  const who = user?.email.split("@")[0] ?? null;

  return (
    <header className="border-b border-rule py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <Link href="/" className="font-serif text-[1.375rem] leading-7 tracking-tight text-ink">
          {brand.productName}
        </Link>
        <nav className="hidden items-baseline gap-4 text-[0.8125rem] leading-5 sm:flex">
          <Link href={frequencyHref} className="text-ink-quiet hover:text-ink">
            Your Frequency
          </Link>
          <Link href="/explore" className="text-ink-quiet hover:text-ink">
            Explore
          </Link>
          <Link href="/search" className="text-ink-quiet hover:text-ink">
            Search
          </Link>
        </nav>
        <div className="flex shrink-0 items-baseline gap-4 text-[0.8125rem] leading-5">
          <Link href={emailHref} className="text-ink-quiet hover:text-ink">
            Email
          </Link>
          {user ? (
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-ink-quiet hover:text-ink">
                {who}
              </button>
            </form>
          ) : (
            <Link href="/signin" className="text-ink-quiet hover:text-ink">
              Sign in
            </Link>
          )}
        </div>
      </div>
      <nav className="mt-2 flex gap-4 text-[0.8125rem] leading-5 sm:hidden">
        <Link href={frequencyHref} className="text-ink-quiet hover:text-ink">
          Frequency
        </Link>
        <Link href="/explore" className="text-ink-quiet hover:text-ink">
          Explore
        </Link>
        <Link href="/search" className="text-ink-quiet hover:text-ink">
          Search
        </Link>
      </nav>
    </header>
  );
}
