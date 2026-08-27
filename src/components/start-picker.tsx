"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STARTER_MAX, STARTER_MIN, STARTER_TOPICS } from "@/lib/frequency/starters";

export function StartPicker({
  signedIn,
  initial,
}: {
  signedIn: boolean;
  initial: string[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applied = useRef(false);

  async function followAll(slugs: string[]) {
    setPending(true);
    setError(null);
    try {
      for (const slug of slugs) {
        const response = await fetch("/api/frequency/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, action: "follow" }),
        });
        if (response.status === 401) {
          router.push(`/signin?next=${encodeURIComponent(`/start?topics=${slugs.join(",")}`)}`);
          return;
        }
        if (!response.ok) {
          setError("Could not follow one of those topics. Try another set.");
          return;
        }
      }
      router.replace("/?welcome=1");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (applied.current) return;
    if (signedIn && initial.length >= STARTER_MIN) {
      applied.current = true;
      void followAll(initial);
    }
  }, [signedIn, initial]);

  function toggle(slug: string) {
    setPicked((current) => {
      if (current.includes(slug)) return current.filter((row) => row !== slug);
      if (current.length >= STARTER_MAX) return current;
      return [...current, slug];
    });
  }

  function onContinue() {
    if (picked.length < STARTER_MIN) {
      setError(`Pick at least ${STARTER_MIN}.`);
      return;
    }
    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent(`/start?topics=${picked.join(",")}`)}`);
      return;
    }
    void followAll(picked);
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-1">
        {STARTER_TOPICS.map((topic) => {
          const on = picked.includes(topic.slug);
          return (
            <li key={topic.slug}>
              <button
                type="button"
                onClick={() => toggle(topic.slug)}
                aria-pressed={on}
                className={`flex min-h-11 w-full items-center justify-between border-t border-rule px-0 text-left ${
                  on ? "text-ink" : "text-ink-quiet"
                }`}
              >
                <span className="font-serif text-[1.0625rem] leading-6">{topic.name}</span>
                <span className="meta">{on ? "Selected" : "Add"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="meta">
        {picked.length} selected · pick {STARTER_MIN}–{STARTER_MAX}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={onContinue}
        className="inline-flex min-h-11 items-center border-b border-ink font-mono text-[12px]/[16px] text-ink disabled:opacity-50"
      >
        {pending ? "Building" : signedIn ? "Start my Frequency" : "Continue"}
      </button>
      {error ? <p className="text-[0.9375rem] leading-6 text-status-disputed">{error}</p> : null}
    </div>
  );
}
