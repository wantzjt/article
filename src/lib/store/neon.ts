import { neon } from "@neondatabase/serverless";
import type {
  BriefRecord,
  ClaimRecord,
  ClaimSourceRecord,
  SourceRecord,
  TopicRecord,
  TopicVersionRecord,
} from "@/lib/compiler/types";
import { emptyGraph, type GraphSnapshot, type PipelineRunRecord, type SpendEvent } from "./graph";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

function iso(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

function isoRequired(value: unknown): string {
  return iso(value) ?? new Date().toISOString();
}

export async function loadGraphFromNeon(): Promise<GraphSnapshot | null> {
  const sql = db();
  try {
    const topics = await sql.query("SELECT * FROM topics");
    if (!topics.length) return null;
    const [sources, claims, claimSources, briefs, versions, spend, runs] = await Promise.all([
      sql.query("SELECT * FROM sources"),
      sql.query("SELECT * FROM claims"),
      sql.query("SELECT * FROM claim_sources"),
      sql.query("SELECT * FROM briefs"),
      sql.query("SELECT * FROM topic_versions"),
      sql.query("SELECT * FROM ai_spend_events"),
      sql.query("SELECT * FROM pipeline_runs"),
    ]);
    return {
      topics: topics.map(mapTopic),
      sources: sources.map(mapSource),
      claims: claims.map(mapClaim),
      claimSources: claimSources.map(mapClaimSource),
      briefs: briefs.map(mapBrief),
      versions: versions.map(mapVersion),
      spend: spend.map(mapSpend),
      runs: runs.map(mapRun),
    };
  } catch {
    return null;
  }
}

export async function saveGraphToNeon(graph: GraphSnapshot): Promise<void> {
  const sql = db();
  for (const topic of graph.topics) {
    await sql.query(
      `INSERT INTO topics (
         id, slug, name, entity_type, description, aliases, official_domains, status,
         created_at, updated_at, last_verified_at, last_material_change_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug,
         name = EXCLUDED.name,
         entity_type = EXCLUDED.entity_type,
         description = EXCLUDED.description,
         aliases = EXCLUDED.aliases,
         official_domains = EXCLUDED.official_domains,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at,
         last_verified_at = EXCLUDED.last_verified_at,
         last_material_change_at = EXCLUDED.last_material_change_at`,
      [
        topic.id,
        topic.slug,
        topic.name,
        topic.entityType,
        topic.description,
        JSON.stringify(topic.aliases),
        JSON.stringify(topic.officialDomains),
        topic.status,
        topic.createdAt,
        topic.updatedAt,
        topic.lastVerifiedAt,
        topic.lastMaterialChangeAt,
      ],
    );
  }
  for (const source of graph.sources) {
    await sql.query(
      `INSERT INTO sources (
         id, canonical_url, title, publisher, publisher_domain, author, published_at,
         retrieved_at, source_type, primary_status, content_hash, evidence_excerpt, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         canonical_url = EXCLUDED.canonical_url,
         title = EXCLUDED.title,
         publisher = EXCLUDED.publisher,
         publisher_domain = EXCLUDED.publisher_domain,
         author = EXCLUDED.author,
         published_at = EXCLUDED.published_at,
         retrieved_at = EXCLUDED.retrieved_at,
         source_type = EXCLUDED.source_type,
         primary_status = EXCLUDED.primary_status,
         content_hash = EXCLUDED.content_hash,
         evidence_excerpt = EXCLUDED.evidence_excerpt,
         metadata = EXCLUDED.metadata`,
      [
        source.id,
        source.canonicalUrl,
        source.title,
        source.publisher,
        source.publisherDomain,
        source.author,
        source.publishedAt,
        source.retrievedAt,
        source.sourceType,
        source.primaryStatus,
        source.contentHash,
        source.evidenceExcerpt,
        JSON.stringify(source.metadata ?? {}),
      ],
    );
  }
  for (const claim of graph.claims) {
    await sql.query(
      `INSERT INTO claims (
         id, topic_id, claim_text, normalized_claim, status, first_seen_at,
         last_verified_at, superseded_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         claim_text = EXCLUDED.claim_text,
         normalized_claim = EXCLUDED.normalized_claim,
         status = EXCLUDED.status,
         last_verified_at = EXCLUDED.last_verified_at,
         superseded_at = EXCLUDED.superseded_at,
         updated_at = EXCLUDED.updated_at`,
      [
        claim.id,
        claim.topicId,
        claim.claimText,
        claim.normalizedClaim,
        claim.status,
        claim.firstSeenAt,
        claim.lastVerifiedAt,
        claim.supersededAt,
        claim.createdAt,
        claim.updatedAt,
      ],
    );
  }
  for (const link of graph.claimSources) {
    await sql.query(
      `INSERT INTO claim_sources (claim_id, source_id, support_type, evidence_excerpt, created_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (claim_id, source_id, support_type) DO UPDATE SET
         evidence_excerpt = EXCLUDED.evidence_excerpt`,
      [link.claimId, link.sourceId, link.supportType, link.evidenceExcerpt, link.createdAt],
    );
  }
  for (const brief of graph.briefs) {
    await sql.query(
      `INSERT INTO briefs (
         id, topic_id, slug, headline, summary, window_start, window_end,
         published_at, status, render_data
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         headline = EXCLUDED.headline,
         summary = EXCLUDED.summary,
         window_start = EXCLUDED.window_start,
         window_end = EXCLUDED.window_end,
         published_at = EXCLUDED.published_at,
         status = EXCLUDED.status,
         render_data = EXCLUDED.render_data`,
      [
        brief.id,
        brief.topicId,
        brief.slug,
        brief.headline,
        brief.summary,
        brief.windowStart,
        brief.windowEnd,
        brief.publishedAt,
        brief.status,
        JSON.stringify(brief.renderData ?? {}),
      ],
    );
  }
  for (const version of graph.versions) {
    await sql.query(
      `INSERT INTO topic_versions (id, topic_id, created_at, material_hash, claim_snapshot, change_summary)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)
       ON CONFLICT (id) DO NOTHING`,
      [
        version.id,
        version.topicId,
        version.createdAt,
        version.materialHash,
        JSON.stringify(version.claimSnapshot ?? {}),
        version.changeSummary,
      ],
    );
  }
  for (const event of graph.spend) {
    await sql.query(
      `INSERT INTO ai_spend_events (id, day, stage, topic_id, model, cost_usd, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        isoRequired(event.day).slice(0, 10),
        event.stage,
        event.topicId,
        event.model,
        event.costUsd,
        event.createdAt,
      ],
    );
  }
  for (const run of graph.runs) {
    await sql.query(
      `INSERT INTO pipeline_runs (id, topic_id, status, stages, error, created_at, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         stages = EXCLUDED.stages,
         error = EXCLUDED.error,
         updated_at = EXCLUDED.updated_at`,
      [run.id, run.topicId, run.status, JSON.stringify(run.stages ?? {}), run.error, run.createdAt, run.updatedAt],
    );
  }
}

function mapTopic(row: Record<string, unknown>): TopicRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    entityType: row.entity_type as TopicRecord["entityType"],
    description: String(row.description ?? ""),
    aliases: (row.aliases as string[]) ?? [],
    officialDomains: (row.official_domains as string[]) ?? [],
    status: row.status as TopicRecord["status"],
    createdAt: isoRequired(row.created_at),
    updatedAt: isoRequired(row.updated_at),
    lastVerifiedAt: iso(row.last_verified_at),
    lastMaterialChangeAt: iso(row.last_material_change_at),
  };
}

function mapSource(row: Record<string, unknown>): SourceRecord {
  return {
    id: String(row.id),
    canonicalUrl: String(row.canonical_url),
    title: String(row.title),
    publisher: String(row.publisher),
    publisherDomain: String(row.publisher_domain),
    author: row.author ? String(row.author) : null,
    publishedAt: iso(row.published_at),
    retrievedAt: isoRequired(row.retrieved_at),
    sourceType: row.source_type as SourceRecord["sourceType"],
    primaryStatus: row.primary_status as SourceRecord["primaryStatus"],
    contentHash: String(row.content_hash),
    evidenceExcerpt: String(row.evidence_excerpt ?? ""),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function mapClaim(row: Record<string, unknown>): ClaimRecord {
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    claimText: String(row.claim_text),
    normalizedClaim: String(row.normalized_claim),
    status: row.status as ClaimRecord["status"],
    firstSeenAt: isoRequired(row.first_seen_at),
    lastVerifiedAt: iso(row.last_verified_at),
    supersededAt: iso(row.superseded_at),
    createdAt: isoRequired(row.created_at),
    updatedAt: isoRequired(row.updated_at),
  };
}

function mapClaimSource(row: Record<string, unknown>): ClaimSourceRecord {
  return {
    claimId: String(row.claim_id),
    sourceId: String(row.source_id),
    supportType: row.support_type as ClaimSourceRecord["supportType"],
    evidenceExcerpt: String(row.evidence_excerpt ?? ""),
    createdAt: isoRequired(row.created_at),
  };
}

function mapBrief(row: Record<string, unknown>): BriefRecord {
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    slug: String(row.slug),
    headline: String(row.headline),
    summary: String(row.summary),
    windowStart: isoRequired(row.window_start),
    windowEnd: isoRequired(row.window_end),
    publishedAt: isoRequired(row.published_at),
    status: row.status as BriefRecord["status"],
    renderData: (row.render_data as BriefRecord["renderData"]) ?? { claimIds: [] },
  };
}

function mapVersion(row: Record<string, unknown>): TopicVersionRecord {
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    createdAt: isoRequired(row.created_at),
    materialHash: String(row.material_hash),
    claimSnapshot: row.claim_snapshot,
    changeSummary: String(row.change_summary ?? ""),
  };
}

function mapSpend(row: Record<string, unknown>): SpendEvent {
  return {
    id: String(row.id),
    day: isoRequired(row.day).slice(0, 10),
    stage: String(row.stage),
    topicId: row.topic_id ? String(row.topic_id) : null,
    model: String(row.model),
    costUsd: Number(row.cost_usd),
    createdAt: isoRequired(row.created_at),
  };
}

function mapRun(row: Record<string, unknown>): PipelineRunRecord {
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    status: row.status as PipelineRunRecord["status"],
    stages: (row.stages as PipelineRunRecord["stages"]) ?? {},
    error: row.error ? String(row.error) : null,
    createdAt: isoRequired(row.created_at),
    updatedAt: isoRequired(row.updated_at),
  };
}

export { emptyGraph };
