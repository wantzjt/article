"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchFollow({ slug, following }: { slug: string; following: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(following);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      const response = await fetch("/api/frequency/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action: on ? "unfollow" : "follow" }),
      });
      if (response.status === 401) {
        router.push(`/signin?next=${encodeURIComponent(`/search?q=${slug}`)}`);
        return;
      }
      if (response.ok) {
        setOn(!on);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void toggle()}
      className="inline-flex min-h-11 items-center font-mono text-[12px]/[16px] text-ink-quiet hover:text-ink disabled:opacity-50"
    >
      {on ? "Following" : "Follow"}
    </button>
  );
}
