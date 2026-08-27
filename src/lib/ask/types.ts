export const ASK_QUESTIONS = [
  { id: "what_changed", label: "What changed?" },
  { id: "why_disputed", label: "Why is this disputed?" },
  { id: "show_source", label: "Show the source." },
] as const;

export type AskQuestion = (typeof ASK_QUESTIONS)[number]["id"];
export type AskTargetKind = "claim" | "source" | "disagreement" | "timeline";

export type AskTarget = {
  kind: AskTargetKind;
  id: string;
};

export type AskCitation = {
  url: string;
  domain: string;
  excerpt: string;
  supportType?: "supports" | "disputes" | "contextualizes";
};

export type AskOk = {
  ok: true;
  question: AskQuestion;
  answer: string;
  sources: AskCitation[];
};

export type AskRefuse = {
  ok: false;
  reason: "not_in_graph" | "not_disputed" | "no_source" | "no_change" | "unknown_question";
  message: string;
};

export type AskResult = AskOk | AskRefuse;

export function isAskQuestion(value: string): value is AskQuestion {
  return ASK_QUESTIONS.some((row) => row.id === value);
}

export function isAskTargetKind(value: string): value is AskTargetKind {
  return value === "claim" || value === "source" || value === "disagreement" || value === "timeline";
}
