export function WhyThis({ explanation, label = "Why this?" }: { explanation: string; label?: string }) {
  return (
    <details className="sources mt-1">
      <summary>{label}</summary>
      <p className="mt-1 pb-2 text-[0.8125rem] leading-5 text-ink-quiet">{explanation}</p>
    </details>
  );
}
