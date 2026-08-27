"use client";

import { useState, type ReactNode } from "react";
import { ASK_QUESTIONS, type AskQuestion, type AskResult, type AskTargetKind } from "@/lib/ask/types";

export function GroundedAsk({
  slug,
  kind,
  id,
  children,
}: {
  slug: string;
  kind: AskTargetKind;
  id: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<AskQuestion | null>(null);
  const [result, setResult] = useState<AskResult | null>(null);

  async function ask(question: AskQuestion) {
    setPending(question);
    try {
      const response = await fetch(`/api/topic/${slug}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, target: { kind, id } }),
      });
      const body = (await response.json()) as AskResult;
      setResult(body);
    } catch {
      setResult({ ok: false, reason: "not_in_graph", message: "Could not load this topic's evidence." });
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        data-ask-kind={kind}
        data-ask-id={id}
        className="w-full text-left"
      >
        {children}
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <p className="meta">Ask from this dossier only.</p>
          <div className="flex flex-wrap gap-3">
            {ASK_QUESTIONS.map((row) => (
              <button
                key={row.id}
                type="button"
                disabled={pending !== null}
                onClick={() => void ask(row.id)}
                className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink disabled:opacity-50"
              >
                {pending === row.id ? "…" : row.label}
              </button>
            ))}
          </div>
          {result ? <AskAnswer result={result} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function AskAnswer({ result }: { result: AskResult }) {
  if (!result.ok) {
    return <p className="mt-2 text-[0.8125rem] leading-5 text-ink-quiet">{result.message}</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      <p className="text-[0.9375rem] leading-6">{result.answer}</p>
      <ul className="space-y-1">
        {result.sources.map((source) => (
          <li key={`${source.url}-${source.supportType ?? "source"}`} className="meta">
            <a
              href={source.url}
              rel="nofollow noopener"
              className="underline decoration-rule underline-offset-2 hover:decoration-ink hover:text-ink"
            >
              {source.domain}
            </a>
            {source.supportType ? ` · ${source.supportType}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
