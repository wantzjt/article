import Link from "next/link";
import { brand } from "@/lib/brand";

export function SiteHeader() {
  return (
    <header className="border-b border-rule py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link href="/" className="font-serif text-[1.375rem] leading-7 tracking-tight text-ink">
            {brand.productName}
          </Link>
          <p className="hidden truncate text-[0.8125rem] leading-5 text-ink-quiet sm:block">
            {brand.tagline}
          </p>
        </div>
        <nav className="flex shrink-0 gap-4 font-sans text-[0.8125rem] leading-5">
          <Link href="/methodology" className="text-ink-quiet hover:text-ink">
            Methodology
          </Link>
          <Link href="/corrections" className="text-ink-quiet hover:text-ink">
            Corrections
          </Link>
        </nav>
      </div>
    </header>
  );
}
