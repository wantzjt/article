"use client";

import { useState, type FormEvent } from "react";

export function TopicRequest({ query }: { query: string }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/topic/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, email: email.trim() || undefined }),
      });
      if (!response.ok) {
        setError("Could not send that request. Try email instead.");
        return;
      }
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return <p className="text-[0.9375rem] leading-6">Noted. We will look at adding it as the graph expands.</p>;
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-3">
      <p className="meta">Request this Topic</p>
      <label className="block space-y-1">
        <span className="meta">Email (optional)</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full border-b border-rule bg-transparent py-2 text-[0.9375rem] leading-6 text-ink outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center border-b border-ink font-mono text-[12px]/[16px] text-ink disabled:opacity-50"
      >
        {pending ? "Sending" : "Request this Topic"}
      </button>
      {error ? <p className="text-[0.9375rem] leading-6 text-status-disputed">{error}</p> : null}
    </form>
  );
}
