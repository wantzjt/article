import { compileBlocked } from "@/lib/compiler/compile-priority";
import type { ChangeKind, TopicStatus } from "@/lib/compiler/types";
import { facetMultiplier, type Facet } from "./facets";
import { interestWeightForChange } from "./interests";

export type FrequencyChange = {
  topicId: string;
  slug: string;
  name: string;
  status: TopicStatus;
  kind: string;
  lastMaterialChangeAt: string | null;
  lastVerifiedAt: string | null;
  sourceCount: number;
  claimCount: number;
  disputed: boolean;
  hasBrief: boolean;
  headline: string;
  changeSummary: string;
  facet: Facet;
  facetChild: string | null;
  sourceUrl: string | null;
  sourceDomain: string | null;
  changeKind: ChangeKind | null;
  relatedSlug: string | null;
};

export type FollowState = {
  topicId: string;
  weight: number;
  muted: boolean;
};

export type FrequencyProfile = {
  userId: string;
  email: string;
  follows: FollowState[];
  /** topicId → facet → −2…+2 */
  facets: Record<string, Partial<Record<Facet, number>>>;
  /** Interest node id → −2…+2. Parent care is not follow-all-children. */
  interests?: Record<string, number>;
};

export type RankedChange = FrequencyChange & {
  globalSignificance: number;
  personalRelevance: number;
  score: number;
  followed: boolean;
  muted: boolean;
  breakthrough: boolean;
  reasons: string[];
};

export const MATERIAL_THRESHOLD = 0.62;
export const UNFOLLOWED_PERSONAL = 0.12;

function hoursAgo(iso: string | null, now: Date): number {
  if (!iso) return 24 * 45;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 24 * 45;
  return Math.max(0, (now.getTime() - then) / 3_600_000);
}

export function globalSignificance(change: FrequencyChange, now = new Date()): number {
  const recency = 1 / (1 + hoursAgo(change.lastMaterialChangeAt, now) / 36);
  const status = change.status === "strong" ? 1 : change.status === "provisional" ? 0.55 : 0.22;
  const sources = Math.min(1, Math.log10(1 + change.sourceCount) / 2);
  const claims = Math.min(1, change.claimCount / 10);
  const extras =
    (change.disputed ? 0.12 : 0) + (change.hasBrief ? 0.1 : 0) + (hoursAgo(change.lastMaterialChangeAt, now) < 24 ? 0.12 : 0);
  const raw = 0.34 * recency + 0.28 * status + 0.16 * sources + 0.12 * claims + extras;
  return Math.max(0, Math.min(1, raw));
}

export function personalRelevance(change: FrequencyChange, profile: FrequencyProfile): number {
  const follow = profile.follows.find((row) => row.topicId === change.topicId);
  if (follow && !follow.muted) {
    const followWeight = follow.weight > 0 ? follow.weight : 1;
    const facetWeight = profile.facets[change.topicId]?.[change.facet] ?? 0;
    return followWeight * facetMultiplier(facetWeight);
  }
  const interest = interestWeightForChange(profile, change);
  if (interest !== 0) return UNFOLLOWED_PERSONAL * facetMultiplier(interest);
  return UNFOLLOWED_PERSONAL;
}

export function hasFollows(profile: FrequencyProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.follows.length > 0) return true;
  return Object.values(profile.interests ?? {}).some((weight) => weight !== 0);
}

/**
 * Frequency is a projection: mute is the only hard exclude.
 * Material world movement can interrupt a low personal weight.
 * Ranking is deterministic. No LLM.
 */
export function rankFrequency(
  changes: FrequencyChange[],
  profile: FrequencyProfile,
  now = new Date(),
): RankedChange[] {
  const followed = new Set(profile.follows.filter((row) => !row.muted).map((row) => row.topicId));
  const muted = new Set(profile.follows.filter((row) => row.muted).map((row) => row.topicId));
  const ranked: RankedChange[] = [];

  for (const change of changes) {
    if (compileBlocked(change.slug)) continue;
    if (muted.has(change.topicId)) continue;
    const global = globalSignificance(change, now);
    const personal = personalRelevance(change, profile);
    const isFollowed = followed.has(change.topicId);
    const viaRelationship = Boolean(change.relatedSlug) && !isFollowed;
    const interest = interestWeightForChange(profile, change);
    const cared = !isFollowed && interest > 0;
    const material = global >= MATERIAL_THRESHOLD || change.changeKind === "disputed" || change.changeKind === "resolved";
    const lowPersonal = personal < 0.7;
    const breakthrough = material && (!isFollowed || lowPersonal || viaRelationship);
    if (!isFollowed && !breakthrough && !viaRelationship && !cared) continue;
    const reasons: string[] = [];
    if (isFollowed) reasons.push("followed");
    else if (cared) reasons.push("interest");
    else if (viaRelationship) reasons.push(`via ${change.relatedSlug}`);
    else reasons.push("unfollowed");
    reasons.push(`facet ${change.facet}${change.facetChild ? `/${change.facetChild}` : ""} ×${personal.toFixed(2)}`);
    reasons.push(`global ${global.toFixed(2)}`);
    if (change.changeKind) reasons.push(change.changeKind);
    if (change.disputed) reasons.push("disagreement");
    if (breakthrough) reasons.push("breakthrough material");
    const score = isFollowed
      ? global * personal + (breakthrough ? global * 0.35 * (1 - Math.min(personal, 1)) : 0)
      : cared
        ? global * Math.min(1, personal * 2.8)
        : global * UNFOLLOWED_PERSONAL + global * 0.55;
    ranked.push({
      ...change,
      globalSignificance: global,
      personalRelevance: personal,
      score,
      followed: isFollowed,
      muted: false,
      breakthrough,
      reasons,
    });
  }

  return ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (b.lastMaterialChangeAt ?? "").localeCompare(a.lastMaterialChangeAt ?? "") ||
      a.name.localeCompare(b.name),
  );
}
