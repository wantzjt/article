import Link from "next/link";
import { brand } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-3 px-4 py-6 text-xs text-muted-foreground">
        <p>
          {brand.productName} maintains topics, not a reprint mill. Every public sentence traces to a
          persisted claim and source.
        </p>
        <div className="flex gap-4">
          <Link href="/llms.txt" className="hover:underline">
            llms.txt
          </Link>
          <Link href="/feed.xml" className="hover:underline">
            RSS
          </Link>
        </div>
      </div>
    </footer>
  );
}
