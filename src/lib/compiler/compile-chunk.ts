import type { SourceRecord } from "./types";

export const EXTRACT_CHUNK_SIZE = 5;
export const VERIFY_CONCURRENCY = 2;
export const MAX_EXTRACT_CHUNKS_PER_TOPIC = 3;
export const TOPIC_COMPILE_BUDGET_MS = 8 * 60_000;
export const MIN_EXTRACT_EXCERPT = 40;

export function shouldSkipExtract(input: {
  acceptedClaimCount: number;
  changedSourceCount: number;
  strongMinClaims: number;
}): "enough_claims" | "unchanged_hash" | null {
  if (input.acceptedClaimCount >= input.strongMinClaims) return "enough_claims";
  if (input.changedSourceCount === 0 && input.acceptedClaimCount >= 1) return "unchanged_hash";
  return null;
}

export function sourcesReadyForExtract(sources: SourceRecord[]): SourceRecord[] {
  return sources.filter((source) => source.evidenceExcerpt.trim().length >= MIN_EXTRACT_EXCERPT);
}

/** Reuse persisted sources only for this topic's official domains or already-linked ids. */
export function cachedSourcesForTopic(
  sources: SourceRecord[],
  officialDomains: string[],
  linkedSourceIds: Iterable<string> = [],
  topicId?: string,
): SourceRecord[] {
  const official = new Set(officialDomains);
  const linked = new Set(linkedSourceIds);
  return sources.filter((source) => {
    if (official.has(source.publisherDomain) || linked.has(source.id)) return true;
    return Boolean(topicId && source.metadata?.topicId === topicId);
  });
}

export function rankSourcesForExtract(
  sources: SourceRecord[],
  officialDomains: string[],
): SourceRecord[] {
  const official = new Set(officialDomains);
  return [...sources].sort((a, b) => {
    const aOfficial = official.has(a.publisherDomain) ? 1 : 0;
    const bOfficial = official.has(b.publisherDomain) ? 1 : 0;
    if (aOfficial !== bOfficial) return bOfficial - aOfficial;
    const aPrimary = a.primaryStatus === "primary" ? 1 : 0;
    const bPrimary = b.primaryStatus === "primary" ? 1 : 0;
    if (aPrimary !== bPrimary) return bPrimary - aPrimary;
    return b.evidenceExcerpt.length - a.evidenceExcerpt.length;
  });
}

export function chunkList<T>(items: T[], size = EXTRACT_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index], index);
    }
  }
  const pool = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: pool }, () => worker()));
  return results;
}
