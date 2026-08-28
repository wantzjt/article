import Link from "next/link";
import { brand } from "@/lib/brand";
import { currentProfile, currentUser } from "@/lib/auth/current-user";
import { hasFollows } from "@/lib/frequency/rank";

export async function SiteHeader() {
  const user = await currentUser();
  const current = user ? await currentProfile() : null;
  const tuned = hasFollows(current?.profile ?? null);
  const homeHref = tuned ? "/" : user ? "/start" : "/";
  const morningHref = user ? "/frequency/preview" : "/signin?next=/frequency/preview";

  return (
    <header className="border-b border-rule py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <Link href="/" className="font-heading text-[1.5rem] leading-7 tracking-tight text-ink lowercase">
          {brand.productName}
        </Link>
        <nav className="hidden min-w-0 flex-1 items-baseline gap-4 text-[0.8125rem] leading-5 sm:flex">
          {user ? (
            <Link href={homeHref} className="text-ink-quiet hover:text-ink">
              Your Frequency
            </Link>
          ) : (
            <Link href="/" className="text-ink-quiet hover:text-ink">
              The World
            </Link>
          )}
          <Link href="/explore" className="text-ink-quiet hover:text-ink">
            Explore
          </Link>
          <Link href="/search" className="text-ink-quiet hover:text-ink">
            Search
          </Link>
        </nav>
        <div className="flex shrink-0 items-baseline gap-4 text-[0.8125rem] leading-5">
          {user ? (
            <>
              <Link href={morningHref} className="text-ink-quiet hover:text-ink">
                Morning Frequency
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="text-ink-quiet hover:text-ink">
                  Account
                </button>
              </form>
            </>
          ) : (
            <Link href="/signin" className="text-ink-quiet hover:text-ink">
              Sign in
            </Link>
          )}
        </div>
      </div>
      <nav className="mt-2 flex gap-4 text-[0.8125rem] leading-5 sm:hidden">
        <Link href={homeHref} className="text-ink-quiet hover:text-ink">
          {user ? "Your Frequency" : "The World"}
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
