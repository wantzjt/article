import { randomUUID } from "node:crypto";
import { PRIMARY_MODEL } from "@/lib/env";
import { generateStructured, generateWithExaSearch } from "@/lib/gateway/ai";
import { collectExaSources, exaSearchTool } from "@/lib/gateway/exa";
import { SEED_ENTITIES } from "@/lib/seed/entities";
import { classifySource } from "./primary";
import { canonicalizeUrl } from "./urls";
import { contentHash } from "./hash";
import { normalizeClaimText } from "./normalize";
import { mergeDuplicateClaims, statusFromEvidence, findMatchingClaim } from "./claims";
import { gateCandidateClaim, excerptSupportsClaim } from "./gate";
import { graduateTopic, shouldPublishBrief } from "./publication";
import { detectMaterialChange } from "./versions";
import { assertUnderModelCap } from "./spend";
import { logPipeline } from "./logger";
import {
  clusterOutputSchema,
  contradictionOutputSchema,
  extractOutputSchema,
  renderOutputSchema,
  verifyOutputSchema,
} from "./schemas";
import type { CandidateClaim, ClaimRecord, ClaimSourceRecord, SourceRecord } from "./types";
import * as store from "@/lib/store/json-store";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export async function ingestTopic(slug: string): Promise<{ topicId: string; runId: string }> {
  const entity = SEED_ENTITIES.find((row) => row.slug === slug);
  if (!entity) throw new Error(`Unknown seed entity: ${slug}`);

  const runId = randomUUID();
  const started = Date.now();
  const existing = await store.getTopicBySlug(slug);
  const topic = await store.upsertTopic({
    id: existing?.topic.id ?? `topic_${slug}`,
    slug: entity.slug,
    name: entity.name,
    entityType: entity.entityType,
    description: existing?.topic.description || entity.description,
    aliases: entity.aliases,
    officialDomains: entity.officialDomains,
    status: existing?.topic.status ?? "stub",
    lastVerifiedAt: existing?.topic.lastVerifiedAt ?? null,
    lastMaterialChangeAt: existing?.topic.lastMaterialChangeAt ?? null,
  });

  await store.saveRun({
    id: runId,
    topicId: topic.id,
    status: "running",
    stages: { discover: "pending", extract: "pending", verify: "pending", render: "pending" },
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  let stage: "discover" | "extract" | "verify" | "render" = "discover";
  try {
    assertUnderModelCap(await store.modelSpendTodayUsd());

    const queries = [
      `${entity.name} official announcement`,
      `${entity.name} pricing availability`,
      `${entity.name} benchmark evaluation dispute`,
    ];
    const cutoff = Date.now() - 48 * 3600 * 1000;
    const cachedSources = (await store.listSources()).filter((source) => {
      const via = source.metadata?.via;
      const retrieved = Date.parse(source.retrievedAt);
      return via === "ai-gateway:exaSearch" && Number.isFinite(retrieved) && retrieved >= cutoff;
    });

    const persistedSources: SourceRecord[] = [];
    if (cachedSources.length >= 8) {
      persistedSources.push(...cachedSources);
    } else {
      const { result, meta: discoverMeta } = await generateWithExaSearch({
        stage: "discover",
        topicId: topic.id,
        exa: exaSearchTool({
          category: entity.entityType === "research" ? "research paper" : "news",
          startPublishedDate: daysAgoIso(21),
        }),
        system:
          "You retrieve evidence. Call exa_search for official, independent, and recent reporting. Do not write an article. Do not invent URLs. After searching, list only the queries you ran.",
        prompt: `Topic: ${entity.name} (${entity.slug})\nOfficial domains: ${entity.officialDomains.join(", ")}\nRun searches:\n- ${queries.join("\n- ")}`,
      });
      await store.recordSpend({
        stage: "discover",
        topicId: topic.id,
        model: PRIMARY_MODEL,
        costUsd: discoverMeta.costUsd,
      });
      const discovered = collectExaSources(result.toolResults ?? [], queries);
      for (const hit of discovered) {
      const canonicalUrl = canonicalizeUrl(hit.canonicalUrl);
      const excerpt = hit.highlights.join(" ").slice(0, 800);
      const hash = contentHash([canonicalUrl, hit.title, excerpt]);
      const prior = await store.findSourceByUrl(canonicalUrl);
      if (prior && prior.contentHash === hash) {
        persistedSources.push(prior);
        continue;
      }
      const classified = classifySource({
        domain: hit.publisherDomain,
        officialDomains: entity.officialDomains,
      });
      const source = await store.upsertSource({
        id: prior?.id ?? randomUUID(),
        canonicalUrl,
        title: hit.title,
        publisher: hit.publisherDomain,
        publisherDomain: hit.publisherDomain,
        author: hit.author,
        publishedAt: hit.publishedAt,
        retrievedAt: new Date().toISOString(),
        sourceType: classified.sourceType,
        primaryStatus: classified.primaryStatus,
        contentHash: hash,
        evidenceExcerpt: excerpt,
        metadata: { query: hit.query, via: "ai-gateway:exaSearch" },
      });
      persistedSources.push(source);
      }
    }

    const seenSourceIds = new Set(persistedSources.map((source) => source.id));
    for (const source of await store.listSources()) {
      if (seenSourceIds.has(source.id)) continue;
      if (entity.officialDomains.includes(source.publisherDomain)) {
        persistedSources.push(source);
        seenSourceIds.add(source.id);
      }
    }

    const priorSources = await store.listSources();
    const priorByUrl = new Map(priorSources.map((source) => [source.canonicalUrl, source]));
    const changedSources = persistedSources.filter((source) => {
      const prior = priorByUrl.get(source.canonicalUrl);
      return !prior || prior.contentHash !== source.contentHash;
    });
    const existingClaims = await store.listClaimsForTopic(topic.id);
    if (
      changedSources.length === 0 &&
      existingClaims.some((claim) => claim.status !== "rejected")
    ) {
      await store.upsertTopic({
        ...topic,
        lastVerifiedAt: new Date().toISOString(),
      });
      logPipeline({
        runId,
        topicId: topic.id,
        stage: "render",
        sourceCount: persistedSources.length,
        claimsProposed: 0,
        claimsAccepted: existingClaims.filter((claim) => claim.status !== "rejected").length,
        claimsRejected: 0,
        durationMs: Date.now() - started,
        model: PRIMARY_MODEL,
        message: "skip_reextract_unchanged_sources",
      });
      await store.saveRun({
        id: runId,
        topicId: topic.id,
        status: "completed",
        stages: { discover: "done", extract: "done", verify: "done", render: "done" },
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { topicId: topic.id, runId };
    }

    if (persistedSources.length === 0) {
      await store.upsertTopic({
        ...topic,
        status: "stub",
        lastVerifiedAt: new Date().toISOString(),
      });
      await store.saveRun({
        id: runId,
        topicId: topic.id,
        status: "completed",
        stages: { discover: "done", extract: "done", verify: "done", render: "done" },
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { topicId: topic.id, runId };
    }

    const evidenceBlock = persistedSources
      .map(
        (source) =>
          `SOURCE_ID=${source.id}\nURL=${source.canonicalUrl}\nTITLE=${source.title}\nDOMAIN=${source.publisherDomain}\nEXCERPT=${source.evidenceExcerpt}`,
      )
      .join("\n\n");

    stage = "extract";
    assertUnderModelCap(await store.modelSpendTodayUsd());
    const extracted = await generateStructured({
      stage: "extract",
      topicId: topic.id,
      schema: extractOutputSchema,
      system:
        "Extract atomic factual claims ONLY from the provided excerpts. Every claim must include a SOURCE_ID from the list. If the excerpt does not contain the fact, omit it. No invented numbers, dates, or quotations.",
      prompt: `Topic: ${entity.name}\n\n${evidenceBlock}`,
    });
    await store.recordSpend({
      stage: "extract",
      topicId: topic.id,
      model: PRIMARY_MODEL,
      costUsd: extracted.meta.costUsd,
    });

    const sourceIds = new Set(persistedSources.map((source) => source.id));
    let candidates: CandidateClaim[] = extracted.object.claims.flatMap((claim) => {
      if (!sourceIds.has(claim.source_id)) return [];
      const source = persistedSources.find((row) => row.id === claim.source_id);
      const excerpt = (claim.evidence_excerpt || source?.evidenceExcerpt || "").slice(0, 800);
      if (!excerpt) return [];
      return [
        {
          claimText: claim.claim,
          sourceId: claim.source_id,
          evidenceExcerpt: excerpt,
          dates: claim.dates ?? [],
          numbers: claim.numbers ?? [],
          entities: claim.entities ?? [],
        },
      ];
    });
    candidates = mergeDuplicateClaims(candidates);

    if (candidates.length > 1) {
      assertUnderModelCap(await store.modelSpendTodayUsd());
      const clustered = await generateStructured({
        stage: "cluster",
        topicId: topic.id,
        schema: clusterOutputSchema,
        system: "Group semantically equivalent claims. Do not invent claims.",
        prompt: candidates.map((claim, index) => `${index}: ${claim.claimText}`).join("\n"),
      });
      await store.recordSpend({
        stage: "cluster",
        topicId: topic.id,
        model: PRIMARY_MODEL,
        costUsd: clustered.meta.costUsd,
      });
      const used = new Set<number>();
      const next: CandidateClaim[] = [];
      for (const group of clustered.object.groups ?? []) {
        const members = group.memberIndexes.filter((index) => candidates[index]);
        if (members.length === 0) continue;
        const representative = candidates[group.representativeIndex] ?? candidates[members[0]];
        next.push(representative);
        for (const index of members) used.add(index);
      }
      candidates.forEach((claim, index) => {
        if (!used.has(index)) next.push(claim);
      });
      candidates = next;
    }

    const accepted: ClaimRecord[] = [];
    const links: ClaimSourceRecord[] = [];
    let rejected = 0;
    stage = "verify";

    for (const candidate of candidates) {
      const gated = gateCandidateClaim(candidate);
      if (!gated.ok) {
        rejected += 1;
        continue;
      }
      const source = persistedSources.find((row) => row.id === candidate.sourceId);
      if (!source) {
        rejected += 1;
        continue;
      }
      if (!excerptSupportsClaim({ claimText: candidate.claimText, excerpt: candidate.evidenceExcerpt })) {
        rejected += 1;
        continue;
      }

      assertUnderModelCap(await store.modelSpendTodayUsd());
      const verified = await generateStructured({
        stage: "verify",
        topicId: topic.id,
        schema: verifyOutputSchema,
        system:
          "You verify whether the EXCERPT supports the CLAIM. Use only the excerpt. If the excerpt is insufficient, verdict is not_supported.",
        prompt: `CLAIM: ${candidate.claimText}\nEXCERPT: ${candidate.evidenceExcerpt}\nURL: ${source.canonicalUrl}`,
      });
      await store.recordSpend({
        stage: "verify",
        topicId: topic.id,
        model: PRIMARY_MODEL,
        costUsd: verified.meta.costUsd,
      });
      if (verified.object.verdict !== "supported") {
        rejected += 1;
        continue;
      }

      const now = new Date().toISOString();
      const matched = findMatchingClaim(candidate.claimText, [...existingClaims, ...accepted]);
      const claim: ClaimRecord = matched
        ? {
            ...matched,
            claimText: candidate.claimText,
            lastVerifiedAt: now,
            updatedAt: now,
            status: matched.status === "rejected" ? "unresolved" : matched.status,
          }
        : {
            id: randomUUID(),
            topicId: topic.id,
            claimText: candidate.claimText,
            normalizedClaim: normalizeClaimText(candidate.claimText),
            status: "unresolved",
            firstSeenAt: now,
            lastVerifiedAt: now,
            supersededAt: null,
            createdAt: now,
            updatedAt: now,
          };
      accepted.push(claim);
      links.push({
        claimId: claim.id,
        sourceId: source.id,
        supportType: "supports",
        evidenceExcerpt: candidate.evidenceExcerpt,
        createdAt: now,
      });
    }

    if (accepted.length > 1) {
      assertUnderModelCap(await store.modelSpendTodayUsd());
      const contradictions = await generateStructured({
        stage: "verify",
        topicId: topic.id,
        schema: contradictionOutputSchema,
        system:
          "Identify pairs of claims that cannot both be true. Do not average them. If unsure, return no pair.",
        prompt: accepted.map((claim, index) => `${index}: ${claim.claimText}`).join("\n"),
      });
      await store.recordSpend({
        stage: "verify",
        topicId: topic.id,
        model: PRIMARY_MODEL,
        costUsd: contradictions.meta.costUsd,
      });
      for (const pair of contradictions.object.pairs ?? []) {
        const a = accepted[pair.aIndex];
        const b = accepted[pair.bIndex];
        if (!a || !b) continue;
        a.status = "disputed";
        b.status = "disputed";
        const aLink = links.find((link) => link.claimId === a.id);
        const bLink = links.find((link) => link.claimId === b.id);
        if (aLink && bLink) {
          links.push({
            claimId: a.id,
            sourceId: bLink.sourceId,
            supportType: "disputes",
            evidenceExcerpt: bLink.evidenceExcerpt,
            createdAt: new Date().toISOString(),
          });
          links.push({
            claimId: b.id,
            sourceId: aLink.sourceId,
            supportType: "disputes",
            evidenceExcerpt: aLink.evidenceExcerpt,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    const persistedClaims: ClaimRecord[] = [];
    for (const claim of accepted) {
      const related = links.filter((link) => link.claimId === claim.id);
      const domains = new Set(
        related.map((link) => persistedSources.find((source) => source.id === link.sourceId)?.publisherDomain),
      );
      const supporting = related.filter((link) => link.supportType === "supports").length;
      const disputing = related.filter((link) => link.supportType === "disputes").length;
      claim.status = statusFromEvidence({
        supportingDomains: Math.min(supporting, domains.size),
        disputingDomains: disputing,
      });
      persistedClaims.push(await store.upsertClaim(claim));
      for (const link of related) await store.attachClaimSource(link);
    }

    const allClaims = await store.listClaimsForTopic(topic.id);
    const allLinks = await store.listClaimSources(allClaims.map((claim) => claim.id));
    const prior = await store.latestVersion(topic.id);
    const material = detectMaterialChange({
      previousHash: prior?.materialHash ?? null,
      claims: allClaims.filter((claim) => claim.status !== "rejected"),
    });

    const publicClaims = allClaims.filter((claim) =>
      ["supported", "single_source", "disputed"].includes(claim.status),
    );
    stage = "render";
    assertUnderModelCap(await store.modelSpendTodayUsd());
    const rendered = await generateStructured({
      stage: "render",
      topicId: topic.id,
      schema: renderOutputSchema,
      system:
        "Write a 1-2 sentence topic description using ONLY the listed claims. Reference claim IDs in whatChanged. NPOV. No unsourced facts. No synthetic quotes.",
      prompt: publicClaims.map((claim) => `${claim.id}: ${claim.claimText} [${claim.status}]`).join("\n"),
    });
    await store.recordSpend({
      stage: "render",
      topicId: topic.id,
      model: PRIMARY_MODEL,
      costUsd: rendered.meta.costUsd,
    });

    const knownIds = new Set(publicClaims.map((claim) => claim.id));
    const whatChanged = (rendered.object.whatChanged ?? []).filter((row) =>
      knownIds.has(row.claimId),
    );

    if (material.changed) {
      await store.addVersion({
        id: randomUUID(),
        topicId: topic.id,
        createdAt: new Date().toISOString(),
        materialHash: material.hash,
        claimSnapshot: { claimIds: publicClaims.map((claim) => claim.id) },
        changeSummary: whatChanged.map((row) => row.summary).join(" ") || "Claim set changed.",
      });
      if (shouldPublishBrief(whatChanged.length)) {
        const windowEnd = new Date().toISOString();
        await store.addBrief({
          id: randomUUID(),
          topicId: topic.id,
          slug: `${topic.slug}-${windowEnd.slice(0, 10)}`,
          headline: whatChanged[0]?.summary ?? `${topic.name} update`,
          summary: rendered.object.description,
          windowStart: daysAgoIso(7),
          windowEnd,
          publishedAt: windowEnd,
          status: "published",
          renderData: { claimIds: whatChanged.map((row) => row.claimId) },
        });
      }
    }

    const status = graduateTopic({
      acceptedClaims: publicClaims,
      claimSources: allLinks,
      sources: persistedSources,
      hasWhatChanged: whatChanged.length > 0 || material.changed,
    });

    await store.upsertTopic({
      ...topic,
      description: rendered.object.description,
      status,
      lastVerifiedAt: new Date().toISOString(),
      lastMaterialChangeAt: material.changed ? new Date().toISOString() : topic.lastMaterialChangeAt,
    });

    logPipeline({
      runId,
      topicId: topic.id,
      stage: "render",
      sourceCount: persistedSources.length,
      claimsProposed: extracted.object.claims.length,
      claimsAccepted: persistedClaims.length,
      claimsRejected: rejected,
      durationMs: Date.now() - started,
      model: PRIMARY_MODEL,
    });

    await store.saveRun({
      id: runId,
      topicId: topic.id,
      status: "completed",
      stages: { discover: "done", extract: "done", verify: "done", render: "done" },
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { topicId: topic.id, runId };
  } catch (error) {
    await store.saveRun({
      id: runId,
      topicId: topic.id,
      status: "failed",
      stages: {
        discover: stage === "discover" ? "failed" : "done",
        extract: stage === "extract" ? "failed" : stage === "discover" ? "pending" : "done",
        verify: stage === "verify" ? "failed" : "pending",
        render: stage === "render" ? "failed" : "pending",
      },
      error: error instanceof Error ? error.message : "unknown",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
}
