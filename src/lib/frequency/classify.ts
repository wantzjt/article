import { neon } from "@neondatabase/serverless";
import type { GraphSnapshot } from "@/lib/store/graph";
import { topicKind } from "@/lib/compiler/taxonomy";
import { classifyFacet, type Facet, type FacetClass } from "./facets";

export type ClassificationMap = Record<string, FacetClass>;

const memory: ClassificationMap = {};

const TABLE = `CREATE TABLE IF NOT EXISTS frequency_classifications (
  subject_id text PRIMARY KEY,
  facet text NOT NULL,
  child text,
  classified_at timestamptz NOT NULL DEFAULT now()
)`;

function useMemory(): boolean {
  return Boolean(process.env.VITEST) || !process.env.DATABASE_URL;
}

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

function classifyTopic(graph: GraphSnapshot, topicId: string): FacetClass {
  const topic = graph.topics.find((row) => row.id === topicId);
  if (!topic) return { facet: "technology", child: null };
  const kind = topicKind(topic);
  const versions = graph.versions.filter((row) => row.topicId === topicId);
  const briefs = graph.briefs.filter((row) => row.topicId === topicId);
  const latestVersion = versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const latestBrief = briefs.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  const text = `${topic.name} ${kind} ${latestBrief?.headline ?? ""} ${latestVersion?.changeSummary ?? ""} ${topic.description}`;
  return classifyFacet({ kind, text });
}

/** One-time deterministic labels. Never on a mere pageview after the first persist. */
export async function loadClassifications(graph: GraphSnapshot): Promise<ClassificationMap> {
  const needed = graph.topics.map((topic) => topic.id);
  if (useMemory()) {
    for (const id of needed) {
      if (!memory[id]) memory[id] = classifyTopic(graph, id);
    }
    return { ...memory };
  }
  const sql = db();
  await sql.query(TABLE);
  const rows = await sql.query("SELECT subject_id, facet, child FROM frequency_classifications");
  const out: ClassificationMap = {};
  for (const row of rows) {
    out[String(row.subject_id)] = {
      facet: String(row.facet) as Facet,
      child: row.child ? String(row.child) : null,
    };
  }
  for (const id of needed) {
    if (out[id]) continue;
    const next = classifyTopic(graph, id);
    await sql.query(
      `INSERT INTO frequency_classifications (subject_id, facet, child)
       VALUES ($1, $2, $3)
       ON CONFLICT (subject_id) DO NOTHING`,
      [id, next.facet, next.child],
    );
    out[id] = next;
  }
  return out;
}

export function resetClassificationMemory(): void {
  for (const key of Object.keys(memory)) delete memory[key];
}
