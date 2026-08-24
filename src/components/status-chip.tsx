import type { ClaimStatus, TopicStatus } from "@/lib/compiler/types";

const LABELS: Record<string, string> = {
  supported: "supported",
  disputed: "disputed",
  single_source: "single-source",
  unresolved: "unresolved",
  superseded: "superseded",
  rejected: "rejected",
  stub: "stub",
  provisional: "provisional",
  strong: "strong",
};

export function StatusChip({ status }: { status: ClaimStatus | TopicStatus }) {
  const tone =
    status === "supported"
      ? "text-status-supported"
      : status === "disputed"
        ? "text-status-disputed"
        : "text-ink";

  return (
    <span className={`font-mono text-[12px]/[16px] tracking-wide ${tone}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
