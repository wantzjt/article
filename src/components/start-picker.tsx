"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { STARTER_MIN, STARTER_TOPICS } from "@/lib/frequency/starters";

export function StartPicker({
  signedIn,
  initial,
  catalog,
}: {
  signedIn: boolean;
  initial: string[];
  catalog: Array<{ slug: string; name: string }>;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applied = useRef(false);
  const names = useMemo(() => new Map(catalog.map((row) => [row.slug, row.name])), [catalog]);

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
      return [...current, slug];
    });
  }

  function onContinue() {
    if (picked.length < STARTER_MIN) {
      setError("Follow at least one Topic, or skip and browse first.");
      return;
    }
    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent(`/start?topics=${picked.join(",")}`)}`);
      return;
    }
    void followAll(picked);
  }

  const q = query.trim().toLowerCase();
  const searchHits = q
    ? catalog
        .filter((row) => !picked.includes(row.slug))
        .filter((row) => row.name.toLowerCase().includes(q) || row.slug.includes(q))
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-6">
      <label className="block space-y-2">
        <span className="kicker">Search Topics</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="NVIDIA, OpenAI, export controls…"
          className="w-full border-b border-rule bg-transparent py-2 text-[0.9375rem] leading-6 text-ink outline-none"
        />
      </label>
      {searchHits.length > 0 ? (
        <ul className="space-y-1">
          {searchHits.map((topic) => (
            <li key={topic.slug}>
              <button
                type="button"
                onClick={() => {
                  toggle(topic.slug);
                  setQuery("");
                }}
                className="flex min-h-11 w-full items-center justify-between border-t border-rule text-left text-ink-quiet hover:text-ink"
              >
                <span className="font-serif text-[1.0625rem] leading-6">{topic.name}</span>
                <span className="meta">Add</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="kicker">Suggested</p>
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

      {picked.length > 0 ? (
        <p className="text-[0.9375rem] leading-6">
          Following {picked.map((slug) => names.get(slug) ?? slug).join(", ")}.
        </p>
      ) : null}

      <div className="flex flex-wrap items-baseline gap-6">
        <button
          type="button"
          disabled={pending}
          onClick={onContinue}
          className="inline-flex min-h-11 items-center border-b border-ink font-mono text-[12px]/[16px] text-ink disabled:opacity-50"
        >
          {pending ? "Building" : signedIn ? "Start my Frequency" : "Continue"}
        </button>
        <Link href="/explore" className="font-mono text-[12px]/[16px] text-ink-quiet hover:text-ink">
          Skip and browse
        </Link>
      </div>
      {error ? <p className="text-[0.9375rem] leading-6 text-status-disputed">{error}</p> : null}
    </div>
  );
}
