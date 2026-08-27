"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Facet } from "@/lib/frequency/facets";

type Row = {
  slug: string;
  name: string;
  muted: boolean;
  level: "HIGH" | "NORMAL" | "LOW" | "MUTED";
  facets: Array<{ facet: Facet; label: string; care: "Less" | "Normal" | "More" }>;
};

const STEPS: Array<"Less" | "Normal" | "More"> = ["Less", "Normal", "More"];
const WEIGHT: Record<(typeof STEPS)[number], number> = { Less: -2, Normal: 0, More: 2 };

export function FrequencyBoard({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [local, setLocal] = useState(rows);

  async function setCare(slug: string, facet: Facet, care: "Less" | "Normal" | "More") {
    setPending(true);
    setLocal((current) =>
      current.map((row) =>
        row.slug === slug
          ? {
              ...row,
              facets: row.facets.map((item) => (item.facet === facet ? { ...item, care } : item)),
            }
          : row,
      ),
    );
    try {
      await fetch("/api/frequency/facets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, facet, weight: WEIGHT[care] }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (local.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink"
      >
        Tune Frequency
      </button>
      {open ? (
        <div className="space-y-5">
          {local.map((row) => (
            <div key={row.slug} className="border-t border-rule pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/topic/${row.slug}`} className="font-serif text-[1.0625rem] leading-6 hover:underline">
                  {row.name}
                </Link>
                <span className="meta">{row.level}</span>
              </div>
              {row.muted ? (
                <p className="meta mt-2">Muted</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {row.facets.map((item) => (
                    <li key={item.facet} className="flex flex-wrap items-center gap-3">
                      <span className="meta w-28 shrink-0">{item.label}</span>
                      <div className="flex gap-3">
                        {STEPS.map((step) => (
                          <button
                            key={step}
                            type="button"
                            disabled={pending}
                            aria-pressed={item.care === step}
                            className={`inline-flex min-h-11 items-center font-mono text-[12px]/[16px] disabled:opacity-50 ${
                              item.care === step ? "border-b border-ink text-ink" : "text-ink-quiet hover:text-ink"
                            }`}
                            onClick={() => void setCare(row.slug, item.facet, step)}
                          >
                            {step}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
