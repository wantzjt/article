import Link from "next/link";
import { brand } from "@/lib/brand";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-6 px-4 py-5">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          {brand.productName}
        </Link>
        <p className="hidden text-sm text-muted-foreground sm:block">{brand.tagline}</p>
        <nav className="flex gap-4 text-sm">
          <Link href="/methodology" className="hover:underline">
            Methodology
          </Link>
          <Link href="/corrections" className="hover:underline">
            Corrections
          </Link>
        </nav>
      </div>
    </header>
  );
}
