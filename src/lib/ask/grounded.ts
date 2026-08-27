import type { ClaimWithEvidence, TopicGraph } from "@/lib/store/graph";
import {
  isAskQuestion,
  type AskCitation,
  type AskQuestion,
  type AskRefuse,
  type AskResult,
  type AskTarget,
} from "./types";

export {
  ASK_QUESTIONS,
  isAskQuestion,
  isAskTargetKind,
  type AskCitation,
  type AskOk,
  type AskQuestion,
  type AskRefuse,
  type AskResult,
  type AskTarget,
  type AskTargetKind,
} from "./types";

function shortExcerpt(text: string, max = 160): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

function citation(
  item: ClaimWithEvidence["evidence"][number],
): AskCitation {
  return {
    url: item.source.canonicalUrl,
    domain: item.source.publisherDomain,
    excerpt: shortExcerpt(item.evidenceExcerpt, 180),
    supportType: item.supportType,
  };
}

function claimById(graph: TopicGraph, id: string): ClaimWithEvidence | null {
  return graph.claims.find((row) => row.id === id && row.status !== "rejected") ?? null;
}

function sourceById(graph: TopicGraph, id: string) {
  return graph.sources.find((row) => row.id === id) ?? null;
}

function versionById(graph: TopicGraph, id: string) {
  return graph.versions.find((row) => row.id === id) ?? null;
}

function snapshotClaimIds(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const ids = (snapshot as { claimIds?: unknown }).claimIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((row): row is string => typeof row === "string");
}

function latestBrief(graph: TopicGraph) {
  return graph.briefs[0] ?? null;
}

function pickSources(claim: ClaimWithEvidence): AskCitation[] {
  const primary = claim.evidence.filter((row) => row.source.primaryStatus === "primary");
  const list = primary.length ? primary : claim.evidence;
  return list.map(citation);
}

function refuse(reason: AskRefuse["reason"], message: string): AskRefuse {
  return { ok: false, reason, message };
}

function answerWhatChanged(graph: TopicGraph, claim: ClaimWithEvidence): AskResult {
  const brief = latestBrief(graph);
  const inBrief = Boolean(brief?.renderData.claimIds.includes(claim.id));
  const latestVersion = [...graph.versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const sources = pickSources(claim);
  if (inBrief && brief) {
    return {
      ok: true,
      question: "what_changed",
      answer: `${brief.headline} ${brief.summary}`.trim(),
      sources,
    };
  }
  if (latestVersion) {
    return {
      ok: true,
      question: "what_changed",
      answer: latestVersion.changeSummary,
      sources,
    };
  }
  return refuse("no_change", "No material change is persisted on this topic.");
}

function answerWhyDisputed(claim: ClaimWithEvidence): AskResult {
  if (claim.status !== "disputed") {
    return refuse("not_disputed", "Article.fm is not calling this disputed.");
  }
  const supports = claim.evidence.filter((row) => row.supportType === "supports");
  const disputes = claim.evidence.filter((row) => row.supportType === "disputes");
  if (supports.length + disputes.length === 0) {
    return refuse("no_source", "No persisted sources are attached to this disagreement.");
  }
  const supportLine = supports[0]
    ? `${supports[0].source.publisherDomain} supports: ${shortExcerpt(supports[0].evidenceExcerpt, 140)}`
    : "No supporting source is stored.";
  const disputeLine = disputes[0]
    ? `${disputes[0].source.publisherDomain} disputes: ${shortExcerpt(disputes[0].evidenceExcerpt, 140)}`
    : "No disputing source is stored.";
  return {
    ok: true,
    question: "why_disputed",
    answer: `This claim is stored as disputed. ${supportLine} ${disputeLine}`,
    sources: [...supports, ...disputes].map(citation),
  };
}

function answerShowSource(claim: ClaimWithEvidence): AskResult {
  const sources = pickSources(claim);
  const first = sources[0];
  if (!first) return refuse("no_source", "No persisted source is attached to this claim.");
  return {
    ok: true,
    question: "show_source",
    answer: `${first.domain}: ${first.excerpt}`,
    sources,
  };
}

function answerFromClaim(graph: TopicGraph, claim: ClaimWithEvidence, question: AskQuestion): AskResult {
  if (question === "what_changed") return answerWhatChanged(graph, claim);
  if (question === "why_disputed") return answerWhyDisputed(claim);
  return answerShowSource(claim);
}

function claimsForSource(graph: TopicGraph, sourceId: string): ClaimWithEvidence[] {
  return graph.claims.filter(
    (claim) => claim.status !== "rejected" && claim.evidence.some((row) => row.source.id === sourceId),
  );
}

/**
 * Grounded Ask v0. Answers only from persisted claims/sources on this topic.
 * No model. No memory. Unknown targets refuse.
 */
export function answerAsk(graph: TopicGraph, target: AskTarget, question: string): AskResult {
  if (!isAskQuestion(question)) {
    return refuse("unknown_question", "Ask only: What changed?, Why is this disputed?, or Show the source.");
  }
  if (target.kind === "claim" || target.kind === "disagreement") {
    const claim = claimById(graph, target.id);
    if (!claim) return refuse("not_in_graph", "That claim is not on this topic.");
    if (target.kind === "disagreement" && claim.status !== "disputed") {
      return refuse("not_disputed", "Article.fm is not calling this disputed.");
    }
    return answerFromClaim(graph, claim, question);
  }
  if (target.kind === "source") {
    const source = sourceById(graph, target.id);
    if (!source) return refuse("not_in_graph", "That source is not on this topic.");
    const linked = claimsForSource(graph, source.id);
    if (question === "show_source") {
      return {
        ok: true,
        question,
        answer: `${source.publisherDomain}: ${shortExcerpt(source.evidenceExcerpt || source.title, 180)}`,
        sources: [
          {
            url: source.canonicalUrl,
            domain: source.publisherDomain,
            excerpt: shortExcerpt(source.evidenceExcerpt || source.title, 180),
          },
        ],
      };
    }
    if (question === "why_disputed") {
      const disputed = linked.find((claim) => claim.status === "disputed");
      if (!disputed) return refuse("not_disputed", "This source is not attached to a persisted disagreement.");
      return answerWhyDisputed(disputed);
    }
    const changed = linked.find((claim) => latestBrief(graph)?.renderData.claimIds.includes(claim.id));
    if (changed) return answerWhatChanged(graph, changed);
    if (linked[0]) return answerWhatChanged(graph, linked[0]);
    return refuse("no_change", "No persisted claim on this source has a change window.");
  }
  const version = versionById(graph, target.id);
  if (!version) return refuse("not_in_graph", "That timeline event is not on this topic.");
  const ids = snapshotClaimIds(version.claimSnapshot);
  const snapshotClaims = ids.map((id) => claimById(graph, id)).filter((row): row is ClaimWithEvidence => Boolean(row));
  if (question === "what_changed") {
    const sources = snapshotClaims.flatMap(pickSources).slice(0, 4);
    if (!version.changeSummary.trim()) return refuse("no_change", "No change summary is persisted for this event.");
    return { ok: true, question, answer: version.changeSummary, sources };
  }
  if (question === "why_disputed") {
    const disputed = snapshotClaims.find((claim) => claim.status === "disputed");
    if (!disputed) return refuse("not_disputed", "This timeline event has no persisted disagreement.");
    return answerWhyDisputed(disputed);
  }
  const sources = snapshotClaims.flatMap(pickSources);
  const first = sources[0];
  if (!first) return refuse("no_source", "No persisted source is attached to this timeline event.");
  return { ok: true, question, answer: `${first.domain}: ${first.excerpt}`, sources: sources.slice(0, 4) };
}
