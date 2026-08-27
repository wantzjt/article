import Link from "next/link";
import type { ReactNode } from "react";
import { FrequencyList } from "@/components/frequency-list";
import { formatRelative, isFreshChange } from "@/lib/render/topic-view";

export type WorldFeedRow = {
  slug: string;
  name: string;
  kind?: string;
  child?: string | null;
  lastMaterialChangeAt: string | null;
  change: string;
  breakthrough?: boolean;
  worldMoved?: boolean;
};

export function WorldFeed({
  rows,
  rest,
  orderKey,
  personalized,
  now,
}: {
  rows: WorldFeedRow[];
  rest?: Array<{ slug: string; name: string }>;
  orderKey: string;
  personalized: boolean;
  now: Date;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 text-[0.9375rem] leading-6 text-ink-quiet">
        {personalized ? "Follow a few topics to build a Frequency." : "Nothing material moved in the recent window."}
      </p>
    );
  }

  const list = (
    <ul className="mt-4">
      {rows.map((row) => {
        const fresh = isFreshChange(row.lastMaterialChangeAt, now);
        const world = Boolean(row.worldMoved);
        return (
          <li
            key={row.slug}
            data-frequency-slug={row.slug}
            className={`border-t border-rule py-3 first:border-t-0 pl-3 ${
              world ? "border-l-2 border-l-signal" : "border-l-2 border-l-rule"
            } ${fresh ? "world-fresh" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/topic/${row.slug}#what-changed`}
                className="font-serif text-[1.0625rem] leading-6 tracking-tight text-ink hover:underline"
              >
                {row.name}
              </Link>
              <span className="meta shrink-0">
                {fresh ? "● New" : formatRelative(row.lastMaterialChangeAt, now)}
              </span>
            </div>
            <p className="meta mt-1">
              {row.kind}
              {row.child ? ` · ${row.child}` : ""}
              {world ? " · World changed" : ""}
              {row.breakthrough ? " · material interrupt" : ""}
            </p>
            <p className="mt-1 text-[0.9375rem] leading-6 text-ink">{row.change}</p>
          </li>
        );
      })}
    </ul>
  );

  const wrapped: ReactNode = personalized ? (
    <FrequencyList orderKey={orderKey}>{list}</FrequencyList>
  ) : (
    <div data-frequency-order={orderKey}>{list}</div>
  );

  return (
    <div>
      {wrapped}
      {rest && rest.length > 0 ? (
        <details className="sources mt-2">
          <summary>More ({rest.length})</summary>
          <ul className="mt-1 pb-3">
            {rest.map((row) => (
              <li key={row.slug} className="border-t border-rule py-2 first:border-t-0">
                <Link href={`/topic/${row.slug}#what-changed`} className="text-[0.8125rem] leading-5 hover:underline">
                  {row.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
