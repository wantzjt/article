"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FACETS, type Facet } from "@/lib/frequency/facets";

type Follow = { muted: boolean } | null;

export function FrequencyControls({
  slug,
  signedIn,
  follow,
  facets,
}: {
  slug: string;
  signedIn: boolean;
  follow: Follow;
  facets: Partial<Record<Facet, number>>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [weights, setWeights] = useState(facets);
  const next = `/topic/${slug}`;

  async function post(url: string, body: Record<string, unknown>) {
    setPending(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!signedIn) {
    return (
      <p className="meta">
        <a href={`/signin?next=${encodeURIComponent(next)}`} className="hover:text-ink">
          Sign in to follow
        </a>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        {follow ? (
          <>
            <span className="inline-flex min-h-11 items-center font-mono text-[12px]/[16px] text-ink">
              Following
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => post("/api/frequency/follow", { slug, action: "unfollow" })}
              className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink disabled:opacity-50"
            >
              Unfollow
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                post("/api/frequency/follow", { slug, action: follow.muted ? "unmute" : "mute" })
              }
              className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink disabled:opacity-50"
            >
              {follow.muted ? "Muted" : "Mute"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => post("/api/frequency/follow", { slug, action: "follow" })}
            className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink disabled:opacity-50"
          >
            Follow
          </button>
        )}
      </div>
      {follow && !follow.muted ? (
        <div className="space-y-2">
          <p className="meta">Tune down is quieter, not hidden.</p>
          {FACETS.map((facet) => {
            const value = weights[facet] ?? 0;
            return (
              <label key={facet} className="flex items-center gap-3">
                <span className="meta w-28 shrink-0">{facet}</span>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={1}
                  value={value}
                  disabled={pending}
                  aria-label={`${facet} ${value}`}
                  className="min-w-0 flex-1 accent-[var(--ink)]"
                  onChange={(event) => {
                    const nextWeight = Number(event.currentTarget.value);
                    setWeights((prev) => ({ ...prev, [facet]: nextWeight }));
                  }}
                  onPointerUp={(event) => {
                    const nextWeight = Number(event.currentTarget.value);
                    void post("/api/frequency/facets", { slug, facet, weight: nextWeight });
                  }}
                  onKeyUp={(event) => {
                    const nextWeight = Number(event.currentTarget.value);
                    void post("/api/frequency/facets", { slug, facet, weight: nextWeight });
                  }}
                />
                <span className="meta w-6 text-right">{value > 0 ? `+${value}` : value}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
