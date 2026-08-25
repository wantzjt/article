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
import { dropClaimsWithoutKnownSource, excerptSupportsClaim, gateCandidateClaim } from "./gate";
import { failClosedStatus, graduateTopic, shouldPublishBrief, STRONG_MIN_CLAIMS } from "./publication";
import { acceptVerifyObject, shouldRunExtract, statusAfterRenderTimeout } from "./fail-closed";
import { detectMaterialChange } from "./versions";
import { assertUnderModelCap, ModelSpendCapError } from "./spend";
import { logPipeline } from "./logger";
import {
  EXTRACT_STAGE_TIMEOUT_MS,
  StageTimeoutError,
  VERIFY_CALL_TIMEOUT_MS,
  runWithStageTimeout,
} from "./timeout";
import {
  EXTRACT_CHUNK_SIZE,
  MAX_EXTRACT_CHUNKS_PER_TOPIC,
  TOPIC_COMPILE_BUDGET_MS,
  VERIFY_CONCURRENCY,
  chunkList,
  mapPool,
  cachedSourcesForTopic,
  rankSourcesForExtract,
  shouldSkipExtract,
  sourcesReadyForExtract,
} from "./compile-chunk";
import { revalidateTopicSurfaces } from "./revalidate";
import { extractOutputSchema, renderOutputSchema, verifyOutputSchema } from "./schemas";
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
      `${entity.name} ${entity.officialDomains[0] ?? ""}`.trim(),
      `${entity.name} pricing availability`,
      `${entity.name} benchmark evaluation dispute`,
      `${entity.name} latest news`,
    ];

    const persistedSources: SourceRecord[] = [];
    const existingClaimsAtStart = await store.listClaimsForTopic(topic.id);
    const acceptedAtStart = existingClaimsAtStart.filter((claim) => claim.status !== "rejected");
    const officialExisting = cachedSourcesForTopic(await store.listSources(), entity.officialDomains);
    const skipDiscover = acceptedAtStart.length >= 1 || officialExisting.length >= 8;
    if (skipDiscover) {
      persistedSources.push(...officialExisting);
      const linked = await store.listClaimSources(acceptedAtStart.map((claim) => claim.id));
      const byId = new Map((await store.listSources()).map((source) => [source.id, source]));
      for (const link of linked) {
        const source = byId.get(link.sourceId);
        if (source && !persistedSources.some((row) => row.id === source.id)) persistedSources.push(source);
      }
      logPipeline({
        runId,
        topicId: topic.id,
        stage: "discover",
        sourceCount: persistedSources.length,
        claimsAccepted: acceptedAtStart.length,
        message: "skip_discover_compile_first",
      });
    } else {
    const { result, meta: discoverMeta } = await generateWithExaSearch({
      stage: "discover",
      topicId: topic.id,
      maxSteps: 10,
      exa: exaSearchTool({
        category: entity.entityType === "research" ? "research paper" : "news",
        startPublishedDate: daysAgoIso(180),
      }),
      system:
        "You retrieve evidence. Call exa_search for official, independent, and recent reporting. Do not write an article. Do not invent URLs. After searching, list only the queries you ran.",
      prompt: `Topic: ${entity.name} (${entity.slug})\nOfficial domains: ${entity.officialDomains.join(", ")}\nRun searches:\n- ${queries.join("\n- ")}`,
    });
    await store.recordSpend({
      stage: "discover",
      topicId: topic.id,
      model: discoverMeta.model,
      costUsd: discoverMeta.costUsd,
    });
    const discovered = collectExaSources(result.toolResults ?? [], queries);
    const pendingSources: SourceRecord[] = [];
    for (const hit of discovered) {
      const canonicalUrl = canonicalizeUrl(hit.canonicalUrl);
      const excerpt = (hit.highlights.join(" ") || "").slice(0, 800);
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
      pendingSources.push({
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
    }
    persistedSources.push(...(await store.upsertSources(pendingSources)));
    }

    const seenSourceIds = new Set(persistedSources.map((source) => source.id));
    for (const source of cachedSourcesForTopic(await store.listSources(), entity.officialDomains, seenSourceIds)) {
      if (seenSourceIds.has(source.id)) continue;
      persistedSources.push(source);
      seenSourceIds.add(source.id);
    }

    const priorSources = await store.listSources();
    const priorByUrl = new Map(priorSources.map((source) => [source.canonicalUrl, source]));
    const changedSources = persistedSources.filter((source) => {
      const prior = priorByUrl.get(source.canonicalUrl);
      return !prior || prior.contentHash !== source.contentHash;
    });
    const existingClaims = await store.listClaimsForTopic(topic.id);

    if (!shouldRunExtract(persistedSources.length)) {
      await store.upsertTopic({
        ...topic,
        status: failClosedStatus(existing?.topic.status ?? topic.status, "stub"),
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

    const ranked = rankSourcesForExtract(
      sourcesReadyForExtract(persistedSources),
      entity.officialDomains,
    );
    const chunks = chunkList(ranked, EXTRACT_CHUNK_SIZE).slice(0, MAX_EXTRACT_CHUNKS_PER_TOPIC);
    stage = "extract";
    let claimsProposed = 0;
    let rejected = 0;
    let persistedClaims: ClaimRecord[] = [];
    const compileDeadline = Date.now() + TOPIC_COMPILE_BUDGET_MS;
    const acceptedExisting = existingClaims.filter((claim) => claim.status !== "rejected");
    const skipExtract = shouldSkipExtract({
      acceptedClaimCount: acceptedExisting.length,
      changedSourceCount: changedSources.length,
      strongMinClaims: STRONG_MIN_CLAIMS,
    });
    if (skipExtract) {
      logPipeline({
        runId,
        topicId: topic.id,
        stage: "extract",
        sourceCount: ranked.length,
        claimsAccepted: acceptedExisting.length,
        message: skipExtract === "enough_claims" ? "skip_extract_enough_claims" : "skip_reextract",
      });
    }

    for (const [chunkIndex, chunk] of chunks.entries()) {
      if (skipExtract) break;
      if (Date.now() >= compileDeadline) {
        logPipeline({
          runId,
          topicId: topic.id,
          stage: "extract",
          message: "compile_budget_stop",
          claimsAccepted: persistedClaims.length,
        });
        break;
      }
      assertUnderModelCap(await store.modelSpendTodayUsd());
      const chunkStarted = Date.now();
      try {
        const extracted = await runWithStageTimeout("extract", EXTRACT_STAGE_TIMEOUT_MS, (signal) =>
          generateStructured({
            stage: "extract",
            topicId: topic.id,
            schema: extractOutputSchema,
            abortSignal: signal,
            system:
              "Extract atomic factual claims ONLY from the provided excerpts. Every claim must include a SOURCE_ID from the list. If the excerpt does not contain the fact, omit it. No invented numbers, dates, or quotations.",
            prompt: `Topic: ${entity.name}\n\n${chunk
              .map(
                (source) =>
                  `SOURCE_ID=${source.id}\nURL=${source.canonicalUrl}\nTITLE=${source.title}\nDOMAIN=${source.publisherDomain}\nEXCERPT=${source.evidenceExcerpt}`,
              )
              .join("\n\n")}`,
          }),
        );
        claimsProposed += extracted.object.claims.length;
        logPipeline({
          runId,
          topicId: topic.id,
          stage: "extract",
          durationMs: Date.now() - chunkStarted,
          claimsProposed: extracted.object.claims.length,
          model: extracted.meta.model,
          costUsd: extracted.meta.costUsd,
          message: `extract_ok chunk_${chunkIndex + 1}_of_${chunks.length}${extracted.meta.provider ? ` provider:${extracted.meta.provider}` : ""}`,
        });
        await store.recordSpend({
          stage: "extract",
          topicId: topic.id,
          model: extracted.meta.model,
          costUsd: extracted.meta.costUsd,
        });

        const sourceIds = new Set(chunk.map((source) => source.id));
        let candidates: CandidateClaim[] = dropClaimsWithoutKnownSource(
          extracted.object.claims,
          sourceIds,
        ).flatMap((claim) => {
          if (!sourceIds.has(claim.source_id)) return [];
          const source = chunk.find((row) => row.id === claim.source_id);
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

        stage = "verify";
        const knownClaims = await store.listClaimsForTopic(topic.id);
        const verifyStarted = Date.now();
        const verdicts = await mapPool(candidates, VERIFY_CONCURRENCY, async (candidate) => {
          const gated = gateCandidateClaim(candidate);
          const source = chunk.find((row) => row.id === candidate.sourceId);
          if (
            !gated.ok ||
            !source ||
            !excerptSupportsClaim({ claimText: candidate.claimText, excerpt: candidate.evidenceExcerpt })
          ) {
            return { ok: false as const };
          }
          try {
            assertUnderModelCap(await store.modelSpendTodayUsd());
            const verified = await runWithStageTimeout("verify", VERIFY_CALL_TIMEOUT_MS, (signal) =>
              generateStructured({
                stage: "verify",
                topicId: topic.id,
                schema: verifyOutputSchema,
                abortSignal: signal,
                system:
                  "You verify whether the EXCERPT supports the CLAIM. Use only the excerpt. If the excerpt is insufficient, verdict is not_supported.",
                prompt: `CLAIM: ${candidate.claimText}\nEXCERPT: ${candidate.evidenceExcerpt}\nURL: ${source.canonicalUrl}`,
              }),
            );
            await store.recordSpend({
              stage: "verify",
              topicId: topic.id,
              model: verified.meta.model,
              costUsd: verified.meta.costUsd,
            });
            if (!acceptVerifyObject(verified.object)) return { ok: false as const };
            return { ok: true as const, candidate, source };
          } catch (error) {
            if (error instanceof ModelSpendCapError) throw error;
            return { ok: false as const };
          }
        });

        const accepted: ClaimRecord[] = [];
        const links: ClaimSourceRecord[] = [];
        for (const verdict of verdicts) {
          if (!verdict.ok) {
            rejected += 1;
            continue;
          }
          const now = new Date().toISOString();
          const matched = findMatchingClaim(verdict.candidate.claimText, [...knownClaims, ...accepted]);
          const claim: ClaimRecord = matched
            ? {
                ...matched,
                claimText: verdict.candidate.claimText,
                lastVerifiedAt: now,
                updatedAt: now,
                status: matched.status === "rejected" ? "unresolved" : matched.status,
              }
            : {
                id: randomUUID(),
                topicId: topic.id,
                claimText: verdict.candidate.claimText,
                normalizedClaim: normalizeClaimText(verdict.candidate.claimText),
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
            sourceId: verdict.source.id,
            supportType: "supports",
            evidenceExcerpt: verdict.candidate.evidenceExcerpt,
            createdAt: now,
          });
        }

        for (const claim of accepted) {
          const related = links.filter((link) => link.claimId === claim.id);
          const domains = new Set(
            related.map((link) => chunk.find((source) => source.id === link.sourceId)?.publisherDomain),
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
        const acceptedNow = (await store.listClaimsForTopic(topic.id)).filter(
          (claim) => claim.status !== "rejected",
        ).length;
        if (acceptedNow >= STRONG_MIN_CLAIMS) {
          logPipeline({
            runId,
            topicId: topic.id,
            stage: "verify",
            claimsAccepted: acceptedNow,
            model: PRIMARY_MODEL,
            message: "enough_claims_graduate",
          });
          break;
        }
        logPipeline({
          runId,
          topicId: topic.id,
          stage: "verify",
          durationMs: Date.now() - verifyStarted,
          claimsAccepted: accepted.length,
          claimsRejected: verdicts.filter((row) => !row.ok).length,
          model: PRIMARY_MODEL,
          message: `verify_ok chunk_${chunkIndex + 1}_of_${chunks.length}`,
        });
      } catch (error) {
        if (error instanceof StageTimeoutError) {
          logPipeline({
            runId,
            topicId: topic.id,
            stage: error.stage,
            durationMs: error.durationMs,
            message: `timeout_chunk_${chunkIndex + 1}_of_${chunks.length}`,
          });
          continue;
        }
        throw error;
      }
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
    let renderedDescription = topic.description;
    let whatChanged: Array<{ claimId: string; summary: string }> = publicClaims.slice(0, 3).map((claim) => ({
      claimId: claim.id,
      summary: claim.claimText.replace(/\s+/g, " ").trim().slice(0, 160),
    }));
    if (publicClaims.length > 0) {
      try {
        assertUnderModelCap(await store.modelSpendTodayUsd());
        const rendered = await runWithStageTimeout("render", 45_000, (signal) =>
          generateStructured({
            stage: "render",
            topicId: topic.id,
            schema: renderOutputSchema,
            abortSignal: signal,
            system:
              "Write a 1-2 sentence topic description using ONLY the listed claims. Reference claim IDs in whatChanged. NPOV. No unsourced facts. No synthetic quotes.",
            prompt: publicClaims
              .slice(0, 12)
              .map((claim) => `${claim.id}: ${claim.claimText} [${claim.status}]`)
              .join("\n"),
          }),
        );
        await store.recordSpend({
          stage: "render",
          topicId: topic.id,
          model: rendered.meta.model,
          costUsd: rendered.meta.costUsd,
        });
        renderedDescription = rendered.object.description;
        const knownIds = new Set(publicClaims.map((claim) => claim.id));
        const fromModel = (rendered.object.whatChanged ?? []).filter((row) => knownIds.has(row.claimId));
        if (fromModel.length) whatChanged = fromModel;
      } catch (error) {
        if (!(error instanceof StageTimeoutError) && !(error instanceof ModelSpendCapError)) throw error;
        logPipeline({
          runId,
          topicId: topic.id,
          stage: "render",
          durationMs: error instanceof StageTimeoutError ? error.durationMs : 0,
          message: "render_timeout_use_claim_summaries",
        });
      }
    }

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
          summary: renderedDescription,
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
      hasWhatChanged:
        whatChanged.length > 0 || material.changed || publicClaims.length >= STRONG_MIN_CLAIMS,
    });

    await store.upsertTopic({
      ...topic,
      description: renderedDescription,
      status,
      lastVerifiedAt: new Date().toISOString(),
      lastMaterialChangeAt: material.changed ? new Date().toISOString() : topic.lastMaterialChangeAt,
    });

    logPipeline({
      runId,
      topicId: topic.id,
      stage: "render",
      sourceCount: persistedSources.length,
      claimsProposed,
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
    await revalidateTopicSurfaces(entity.slug);
    return { topicId: topic.id, runId };
  } catch (error) {
    const timeout = error instanceof StageTimeoutError;
    const failedStage = timeout ? error.stage : stage;
    logPipeline({
      runId,
      topicId: topic.id,
      stage: failedStage,
      durationMs: timeout ? error.durationMs : Date.now() - started,
      model: PRIMARY_MODEL,
      message: timeout ? "timeout" : "failed",
    });
    const leftover = (await store.listClaimsForTopic(topic.id)).filter((claim) =>
      ["supported", "single_source", "disputed"].includes(claim.status),
    );
    if (leftover.length >= 1) {
      const leftoverLinks = await store.listClaimSources(leftover.map((claim) => claim.id));
      const leftoverSources = await store.listSources();
      const status = statusAfterRenderTimeout({
        currentStatus: existing?.topic.status ?? topic.status,
        leftoverPublicCount: leftover.length,
        leftoverGraduate: graduateTopic({
          acceptedClaims: leftover,
          claimSources: leftoverLinks,
          sources: leftoverSources,
          hasWhatChanged: leftover.length >= STRONG_MIN_CLAIMS,
        }),
      });
      await store.upsertTopic({
        ...topic,
        status,
        lastVerifiedAt: new Date().toISOString(),
        lastMaterialChangeAt: new Date().toISOString(),
      });
      await store.saveRun({
        id: runId,
        topicId: topic.id,
        status: "completed",
        stages: { discover: "done", extract: "done", verify: "done", render: "done" },
        error: error instanceof Error ? error.message : "unknown",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await revalidateTopicSurfaces(entity.slug);
      logPipeline({
        runId,
        topicId: topic.id,
        stage: "render",
        claimsAccepted: leftover.length,
        message: "graduate_after_error",
      });
      return { topicId: topic.id, runId };
    }
    if ((existing?.topic.status ?? "stub") !== "strong") {
      await store.upsertTopic({
        ...topic,
        status: "stub",
      });
    }
    await store.saveRun({
      id: runId,
      topicId: topic.id,
      status: "failed",
      stages: {
        discover: failedStage === "discover" ? "failed" : "done",
        extract:
          failedStage === "extract" || failedStage === "cluster"
            ? "failed"
            : failedStage === "discover"
              ? "pending"
              : "done",
        verify:
          failedStage === "verify"
            ? "failed"
            : failedStage === "discover" || failedStage === "extract" || failedStage === "cluster"
              ? "pending"
              : "done",
        render: failedStage === "render" ? "failed" : "pending",
      },
      error: error instanceof Error ? error.message : "unknown",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
}
