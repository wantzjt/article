import Link from "next/link";
import type { ReactNode } from "react";
import { FrequencyList } from "@/components/frequency-list";
import { WhyThis } from "@/components/why-this";
import { LinkedText, type LinkedTopic } from "@/lib/render/topic-links";
import { formatRelative, frontDeskLabel, isFreshChange, primaryChangeCopy } from "@/lib/render/topic-view";

export type WorldFeedRow = {
  slug: string;
  name: string;
  kind?: string;
  child?: string | null;
  lastMaterialChangeAt: string | null;
  change: string;
  support?: string | null;
  breakthrough?: boolean;
  worldMoved?: boolean;
  changeKind?: string | null;
  why?: string | null;
  tuned?: boolean;
  moreCount?: number;
};

export function WorldFeed({
  rows,
  rest,
  orderKey,
  personalized,
  now,
  topics,
}: {
  rows: WorldFeedRow[];
  rest?: Array<{ slug: string; name: string }>;
  orderKey: string;
  personalized: boolean;
  now: Date;
  topics?: LinkedTopic[];
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 text-[0.9375rem] leading-6 text-ink-quiet">
        {personalized ? "Follow a few Topics to build a Frequency." : "Nothing material moved just now."}
      </p>
    );
  }

  const catalog = topics ?? [];
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
            <Link
              href={`/topic/${row.slug}#what-changed`}
              className="font-heading text-[1.125rem] leading-6 tracking-tight text-ink hover:underline"
            >
              {row.name}
            </Link>
            <p className="mt-1 text-[0.9375rem] leading-6 text-ink">
              <LinkedText text={primaryChangeCopy(row.change)} topics={catalog} skipSlug={row.slug} />
            </p>
            {row.support ? <p className="mt-1 text-[0.8125rem] leading-5 text-ink-quiet">{row.support}</p> : null}
            <p className="meta mt-1">
              {fresh ? "New" : formatRelative(row.lastMaterialChangeAt, now)}
              {" · "}
              {frontDeskLabel(row.kind, row.child)}
              {world ? " · World changed" : ""}
            </p>
            {(row.moreCount ?? 0) > 0 ? (
              <p className="meta mt-1">
                <Link href={`/topic/${row.slug}#what-changed`} className="hover:text-ink">
                  +{row.moreCount} more {row.moreCount === 1 ? "change" : "changes"}
                </Link>
              </p>
            ) : null}
            {personalized && row.why ? (
              <WhyThis explanation={row.why} label={row.tuned ? "Tuned for you" : "Why this?"} />
            ) : null}
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
          <summary>More</summary>
          <ul className="mt-1 pb-3">
            {rest.map((row) => (
              <li key={row.slug} className="border-t border-rule py-2 first:border-t-0">
                <Link href={`/topic/${row.slug}`} className="text-[0.8125rem] leading-5 hover:underline">
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
