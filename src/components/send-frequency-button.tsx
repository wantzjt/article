"use client";

import { useState } from "react";

export function SendFrequencyButton() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [detail, setDetail] = useState<string | null>(null);

  async function onSend() {
    setStatus("sending");
    setDetail(null);
    try {
      const response = await fetch("/api/frequency/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await response.json()) as {
        sent?: boolean;
        reason?: string;
        error?: string;
        to?: string;
      };
      if (body.reason === "resend_not_wired") {
        setStatus("error");
        setDetail("Resend is not wired.");
        return;
      }
      if (!response.ok || !body.sent) {
        setStatus("error");
        setDetail("Could not send.");
        return;
      }
      setStatus("sent");
      setDetail(body.to ? `Sent to ${body.to}.` : "Sent.");
    } catch {
      setStatus("error");
      setDetail("Could not send.");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={status === "sending"}
        onClick={() => void onSend()}
        className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink disabled:opacity-50"
      >
        {status === "sending" ? "Sending" : "Send a test"}
      </button>
      {detail ? (
        <p className={`text-[0.9375rem] leading-6 ${status === "error" ? "text-status-disputed" : "text-ink"}`}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}
