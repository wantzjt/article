"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { careLabel, FACET_LABEL, topicEmphasis } from "@/lib/frequency/explain";
import { FACETS, type Facet } from "@/lib/frequency/facets";

type Follow = { muted: boolean } | null;

const STEPS: Array<{ label: string; weight: number }> = [
  { label: "Less", weight: -2 },
  { label: "Normal", weight: 0 },
  { label: "More", weight: 2 },
];

function stepFromWeight(weight: number | undefined): number {
  if (!weight) return 0;
  return weight < 0 ? -2 : 2;
}

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
  const [open, setOpen] = useState(false);
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
            <span className="inline-flex min-h-11 items-center font-mono text-[12px]/[16px] text-ink">Following</span>
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
              onClick={() => setOpen((value) => !value)}
              className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink"
            >
              Tune
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
        <p className="meta">
          In your Frequency: {topicEmphasis(weights, follow.muted)}
          {" · "}
          {FACETS.filter((facet) => (weights[facet] ?? 0) !== 0)
            .map((facet) => `${FACET_LABEL[facet]}: ${careLabel(weights[facet])}`)
            .join(" · ") || "all Normal"}
        </p>
      ) : null}
      {follow && !follow.muted && open ? (
        <div className="space-y-2">
          <p className="meta">Less is quieter, not hidden.</p>
          {FACETS.map((facet) => {
            const value = stepFromWeight(weights[facet]);
            return (
              <div key={facet} className="flex flex-wrap items-center gap-3">
                <span className="meta w-28 shrink-0">{FACET_LABEL[facet]}</span>
                <div className="flex gap-3">
                  {STEPS.map((step) => (
                    <button
                      key={step.label}
                      type="button"
                      disabled={pending}
                      aria-pressed={value === step.weight}
                      aria-label={`${facet} ${step.label}`}
                      className={`inline-flex min-h-11 items-center font-mono text-[12px]/[16px] disabled:opacity-50 ${
                        value === step.weight ? "border-b border-ink text-ink" : "text-ink-quiet hover:text-ink"
                      }`}
                      onClick={() => {
                        setWeights((prev) => ({ ...prev, [facet]: step.weight }));
                        void post("/api/frequency/facets", { slug, facet, weight: step.weight });
                      }}
                    >
                      {step.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
