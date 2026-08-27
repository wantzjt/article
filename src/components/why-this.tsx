export function WhyThis({ explanation }: { explanation: string }) {
  return (
    <details className="sources mt-1">
      <summary>Why this?</summary>
      <p className="mt-1 pb-2 text-[0.8125rem] leading-5 text-ink-quiet">{explanation}</p>
    </details>
  );
}
