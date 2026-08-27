"use client";

import { useState } from "react";

export function SignInForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextPath }),
      });
      const body = (await response.json()) as { ok?: boolean; sent?: boolean; error?: string };
      if (!response.ok || !body.ok || !body.sent) {
        setStatus("error");
        setError(
          body.error === "invalid_email"
            ? "Enter a real email."
            : "Could not send the sign-in email. Try again in a minute.",
        );
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Could not send the sign-in email.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-2">
        <span className="kicker">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full border-b border-rule bg-transparent py-2 text-[0.9375rem] leading-6 text-ink outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink disabled:opacity-50"
      >
        {status === "sending" ? "Sending" : "Email a sign-in link"}
      </button>
      {status === "sent" ? (
        <p className="text-[0.9375rem] leading-6 text-ink">Check your email for a 15-minute link.</p>
      ) : null}
      {error ? <p className="text-[0.9375rem] leading-6 text-status-disputed">{error}</p> : null}
    </form>
  );
}
