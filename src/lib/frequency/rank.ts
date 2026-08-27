import { compileBlocked } from "@/lib/compiler/compile-priority";
import type { TopicStatus } from "@/lib/compiler/types";
import { facetMultiplier, inferFacet, type Facet } from "./facets";

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
};

export type RankedChange = FrequencyChange & {
  globalSignificance: number;
  personalRelevance: number;
  score: number;
  followed: boolean;
  muted: boolean;
  breakthrough: boolean;
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
  if (!follow || follow.muted) return UNFOLLOWED_PERSONAL;
  const followWeight = follow.weight > 0 ? follow.weight : 1;
  const facetWeight = profile.facets[change.topicId]?.[change.facet] ?? 0;
  return followWeight * facetMultiplier(facetWeight);
}

export function hasFollows(profile: FrequencyProfile | null | undefined): boolean {
  return Boolean(profile && profile.follows.length > 0);
}

/**
 * Frequency is a projection: mute is the only hard exclude.
 * Material world movement can interrupt a low personal weight.
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
    const breakthrough = !isFollowed && global >= MATERIAL_THRESHOLD;
    if (!isFollowed && !breakthrough) continue;
    const score = isFollowed
      ? global * personal + (global >= MATERIAL_THRESHOLD && personal < 0.7 ? global * 0.25 : 0)
      : global * UNFOLLOWED_PERSONAL + global * 0.55;
    ranked.push({
      ...change,
      globalSignificance: global,
      personalRelevance: personal,
      score,
      followed: isFollowed,
      muted: false,
      breakthrough,
    });
  }

  return ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (b.lastMaterialChangeAt ?? "").localeCompare(a.lastMaterialChangeAt ?? "") ||
      a.name.localeCompare(b.name),
  );
}
