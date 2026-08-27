import { randomUUID } from "node:crypto";
import type { EdgeKind, GraphEdge, TopicRecord } from "./types";

/** First-class graph, not a visualization. Slugs resolved at persist time. */
export const SEED_EDGES: Array<{ from: string; to: string; kind: EdgeKind; evidence: string }> = [
  { from: "blackwell", to: "nvidia", kind: "PRODUCT_OF", evidence: "Blackwell is an NVIDIA GPU architecture." },
  { from: "nvlink", to: "nvidia", kind: "PRODUCT_OF", evidence: "NVLink is NVIDIA's GPU interconnect." },
  { from: "cuda", to: "nvidia", kind: "PRODUCT_OF", evidence: "CUDA is NVIDIA's parallel computing platform." },
  { from: "nvidia-nim", to: "nvidia", kind: "PRODUCT_OF", evidence: "NIM is an NVIDIA inference microservice." },
  { from: "gb200", to: "nvidia", kind: "PRODUCT_OF", evidence: "GB200 is a Grace Blackwell NVIDIA system." },
  { from: "cowos", to: "tsmc", kind: "PRODUCT_OF", evidence: "CoWoS is TSMC advanced packaging." },
  { from: "nvidia", to: "tsmc", kind: "DEPENDS_ON", evidence: "NVIDIA AI GPUs are packaged on TSMC CoWoS." },
  { from: "nvidia", to: "amd", kind: "COMPETES_WITH", evidence: "NVIDIA and AMD compete in accelerators." },
  { from: "jensen-huang", to: "nvidia", kind: "CEO_OF", evidence: "Jensen Huang is CEO of NVIDIA." },
  { from: "lisa-su", to: "amd", kind: "CEO_OF", evidence: "Lisa Su is CEO of AMD." },
  { from: "sam-altman", to: "openai", kind: "CEO_OF", evidence: "Sam Altman is CEO of OpenAI." },
  { from: "dario-amodei", to: "anthropic", kind: "CEO_OF", evidence: "Dario Amodei is CEO of Anthropic." },
  { from: "chatgpt", to: "openai", kind: "PRODUCT_OF", evidence: "ChatGPT is an OpenAI product." },
  { from: "claude-code", to: "anthropic", kind: "PRODUCT_OF", evidence: "Claude Code is an Anthropic product." },
  { from: "claude-4", to: "anthropic", kind: "PRODUCT_OF", evidence: "Claude is Anthropic's model family." },
  { from: "gpt-5", to: "openai", kind: "PRODUCT_OF", evidence: "GPT-5 is an OpenAI model family." },
  { from: "glm-5-3", to: "z-ai", kind: "PRODUCT_OF", evidence: "GLM-5.3 is a Z.ai model." },
  { from: "bis-export-controls", to: "nvidia", kind: "REGULATES", evidence: "US BIS export rules cover advanced AI chips." },
  { from: "eu-ai-act", to: "openai", kind: "REGULATES", evidence: "The EU AI Act covers general-purpose AI providers." },
  { from: "eu-ai-office", to: "eu-ai-act", kind: "PART_OF", evidence: "The EU AI Office implements the AI Act." },
];

export function edgeId(fromId: string, toId: string, kind: EdgeKind): string {
  return `edge_${fromId}_${kind}_${toId}`.slice(0, 120);
}

export function resolveSeedEdges(topics: TopicRecord[], now = new Date()): GraphEdge[] {
  const bySlug = new Map(topics.map((topic) => [topic.slug, topic.id]));
  const createdAt = now.toISOString();
  const out: GraphEdge[] = [];
  for (const row of SEED_EDGES) {
    const fromId = bySlug.get(row.from);
    const toId = bySlug.get(row.to);
    if (!fromId || !toId || fromId === toId) continue;
    out.push({
      id: edgeId(fromId, toId, row.kind),
      fromId,
      toId,
      kind: row.kind,
      sourceId: null,
      evidence: row.evidence,
      createdAt,
    });
  }
  return out;
}

export function mergeEdges(current: GraphEdge[], incoming: GraphEdge[]): { next: GraphEdge[]; added: GraphEdge[] } {
  const key = (row: GraphEdge) => `${row.fromId}|${row.kind}|${row.toId}`;
  const map = new Map(current.map((row) => [key(row), row]));
  const added: GraphEdge[] = [];
  for (const row of incoming) {
    const id = key(row);
    if (map.has(id)) continue;
    map.set(id, { ...row, id: row.id || `edge_${randomUUID()}` });
    added.push(row);
  }
  return { next: [...map.values()], added };
}

export function neighborTopicIds(edges: GraphEdge[], topicId: string): Set<string> {
  const out = new Set<string>();
  for (const edge of edges) {
    if (edge.fromId === topicId) out.add(edge.toId);
    if (edge.toId === topicId) out.add(edge.fromId);
  }
  return out;
}
