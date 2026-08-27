import Link from "next/link";
import { brand } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-ink-quiet">
          {brand.productName} maintains topics, not a reprint mill. Every public sentence traces to a
          persisted claim and source. Corrections stay on the record.
        </p>
        <div className="flex gap-4 font-mono text-[11px]/[14px] text-ink-quiet">
          <Link href="/llms.txt" className="hover:text-ink">
            llms.txt
          </Link>
          <Link href="/feed.xml" className="hover:text-ink">
            RSS
          </Link>
        </div>
      </div>
    </footer>
  );
}
