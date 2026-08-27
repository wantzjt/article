import Link from "next/link";
import { brand } from "@/lib/brand";
import { currentUser } from "@/lib/auth/current-user";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="border-b border-rule py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="font-serif text-[1.375rem] leading-7 tracking-tight text-ink">
            {brand.productName}
          </Link>
          <p className="truncate text-[0.8125rem] leading-5 text-ink-quiet">{brand.tagline}</p>
        </div>
        <nav className="flex shrink-0 flex-wrap items-baseline justify-end gap-x-4 gap-y-1 font-sans text-[0.8125rem] leading-5">
          <Link href="/methodology" className="text-ink-quiet hover:text-ink">
            Methodology
          </Link>
          <Link href="/corrections" className="text-ink-quiet hover:text-ink">
            Corrections
          </Link>
          {user ? (
            <>
              <Link href="/frequency/preview" className="text-ink-quiet hover:text-ink">
                Frequency
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="text-ink-quiet hover:text-ink">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/signin" className="text-ink-quiet hover:text-ink">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
