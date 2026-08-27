import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-ink-quiet">
          The World is shared. Your Frequency is personal. Ask any sentence for the source.
        </p>
        <div className="flex flex-wrap gap-4 font-mono text-[11px]/[14px] text-ink-quiet">
          <Link href="/methodology" className="hover:text-ink">
            Methodology
          </Link>
          <Link href="/corrections" className="hover:text-ink">
            Corrections
          </Link>
          <Link href="/feed.xml" className="hover:text-ink">
            RSS
          </Link>
          <Link href="/llms.txt" className="hover:text-ink">
            llms.txt
          </Link>
        </div>
      </div>
    </footer>
  );
}
