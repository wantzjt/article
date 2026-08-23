import type { ClaimRecord } from "@/lib/compiler/types";

export type ScriptClaim = Pick<ClaimRecord, "id" | "claimText" | "status">;

export type BriefScript = {
  text: string;
  claimIds: string[];
  characterCount: number;
};

const SPOKEN_STATUSES = new Set(["supported", "single_source", "disputed"]);
const MAX_CHARS = 8000;

function speakable(claims: ScriptClaim[]): ScriptClaim[] {
  return claims.filter((claim) => SPOKEN_STATUSES.has(claim.status));
}

export function scriptFromClaims(input: {
  topicName: string;
  whatChangedIds?: string[];
  claims: ScriptClaim[];
}): BriefScript {
  const claims = speakable(input.claims);
  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  const changed = (input.whatChangedIds ?? [])
    .map((id) => byId.get(id))
    .filter((claim): claim is ScriptClaim => Boolean(claim));
  const rest = claims.filter((claim) => !changed.some((row) => row.id === claim.id));
  const disputed = claims.filter((claim) => claim.status === "disputed");

  const lines: string[] = [`This is ${input.topicName}.`];
  const used: string[] = [];

  if (changed.length) {
    lines.push("Here is what changed.");
    for (const claim of changed) {
      lines.push(sentenceFor(claim));
      used.push(claim.id);
    }
  }

  const remaining = rest.filter((claim) => !used.includes(claim.id));
  if (remaining.length) {
    lines.push("These facts are on the record.");
    for (const claim of remaining) {
      lines.push(sentenceFor(claim));
      used.push(claim.id);
    }
  }

  if (disputed.length) {
    lines.push("Sources do not agree on the following.");
    for (const claim of disputed) {
      if (!used.includes(claim.id)) {
        lines.push(sentenceFor(claim));
        used.push(claim.id);
      }
    }
  }

  let text = lines.join(" ").replace(/\s+/g, " ").trim();
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS).trim();
  return { text, claimIds: [...new Set(used)], characterCount: text.length };
}

function sentenceFor(claim: ScriptClaim): string {
  const body = claim.claimText.trim().replace(/\.+$/, "");
  if (claim.status === "disputed") {
    return `There is a conflict: ${body}.`;
  }
  if (claim.status === "single_source") {
    return `${body}, according to a single source.`;
  }
  return `${body}.`;
}
