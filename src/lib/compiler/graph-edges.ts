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
  { from: "grok-4", to: "xai", kind: "PRODUCT_OF", evidence: "Grok is xAI's model family." },
  { from: "gemini-3", to: "google-deepmind", kind: "PRODUCT_OF", evidence: "Gemini is a Google DeepMind model family." },
  { from: "gemini-cli", to: "google-deepmind", kind: "PRODUCT_OF", evidence: "Gemini API products are Google DeepMind surfaces." },
  { from: "llama-4", to: "meta-ai", kind: "PRODUCT_OF", evidence: "Llama is Meta's model family." },
  { from: "deepseek-v3", to: "deepseek", kind: "PRODUCT_OF", evidence: "DeepSeek-V3 is a DeepSeek model." },
  { from: "qwen-3", to: "alibaba-qwen", kind: "PRODUCT_OF", evidence: "Qwen is Alibaba's model family." },
  { from: "nvlink", to: "blackwell", kind: "PART_OF", evidence: "NVLink connects Blackwell GPUs." },
  { from: "gb200", to: "blackwell", kind: "PART_OF", evidence: "GB200 is a Grace Blackwell system." },
  { from: "nvidia", to: "sk-hynix", kind: "DEPENDS_ON", evidence: "NVIDIA AI GPUs use SK hynix HBM." },
  { from: "nvidia", to: "foxconn", kind: "DEPENDS_ON", evidence: "Foxconn manufactures NVIDIA systems." },
  { from: "tsmc", to: "asml", kind: "DEPENDS_ON", evidence: "TSMC advanced nodes depend on ASML lithography." },
  { from: "samsung-foundry", to: "tsmc", kind: "COMPETES_WITH", evidence: "Samsung Foundry and TSMC compete for advanced silicon." },
  { from: "supermicro", to: "nvidia", kind: "DEPENDS_ON", evidence: "Supermicro ships NVIDIA GPU servers." },
  { from: "coreweave", to: "nvidia", kind: "DEPENDS_ON", evidence: "CoreWeave GPU clouds are NVIDIA-based." },
  { from: "satya-nadella", to: "microsoft-ai", kind: "CEO_OF", evidence: "Satya Nadella is CEO of Microsoft." },
  { from: "sundar-pichai", to: "google-deepmind", kind: "CEO_OF", evidence: "Sundar Pichai is CEO of Google and Alphabet." },
  { from: "demis-hassabis", to: "google-deepmind", kind: "CEO_OF", evidence: "Demis Hassabis is CEO of Google DeepMind." },
  { from: "figure-ai", to: "robotics", kind: "PART_OF", evidence: "Figure is a humanoid robotics company." },
  { from: "unitree", to: "robotics", kind: "PART_OF", evidence: "Unitree builds humanoid and quadruped robots." },
  { from: "boston-dynamics", to: "robotics", kind: "PART_OF", evidence: "Boston Dynamics builds mobile robots." },
  { from: "tesla-optimus", to: "robotics", kind: "PART_OF", evidence: "Optimus is Tesla's humanoid robot." },
  { from: "anthropic", to: "openai", kind: "COMPETES_WITH", evidence: "Anthropic and OpenAI compete in frontier models." },
  { from: "xai", to: "openai", kind: "COMPETES_WITH", evidence: "xAI and OpenAI compete in frontier models." },
  { from: "mistral-ai", to: "openai", kind: "COMPETES_WITH", evidence: "Mistral and OpenAI compete in frontier models." },
  { from: "cohere", to: "openai", kind: "COMPETES_WITH", evidence: "Cohere and OpenAI compete in enterprise models." },
  { from: "cerebras", to: "nvidia", kind: "COMPETES_WITH", evidence: "Cerebras competes with NVIDIA in AI accelerators." },
  { from: "sambanova", to: "nvidia", kind: "COMPETES_WITH", evidence: "SambaNova competes with NVIDIA in AI accelerators." },
  { from: "ca-sb-53", to: "openai", kind: "REGULATES", evidence: "California AI bills cover frontier model developers." },
  { from: "anthropic-economic-index", to: "anthropic", kind: "PART_OF", evidence: "The Economic Index is Anthropic research." },
  { from: "sora", to: "openai", kind: "PRODUCT_OF", evidence: "Sora is an OpenAI video model." },
  { from: "openai-codex", to: "openai", kind: "PRODUCT_OF", evidence: "Codex is an OpenAI coding product." },
  { from: "colossus", to: "xai", kind: "PRODUCT_OF", evidence: "Colossus is xAI's training cluster." },
  { from: "nvidia-omniverse", to: "nvidia", kind: "PRODUCT_OF", evidence: "Omniverse is an NVIDIA platform." },
  { from: "nvidia-cosmos", to: "nvidia", kind: "PRODUCT_OF", evidence: "Cosmos is an NVIDIA world model family." },
  { from: "mira-murati", to: "thinking-machines", kind: "CEO_OF", evidence: "Mira Murati founded Thinking Machines Lab." },
  { from: "ilya-sutskever", to: "safe-superintelligence", kind: "CEO_OF", evidence: "Ilya Sutskever co-founded SSI." },
  { from: "github-copilot", to: "microsoft-ai", kind: "PRODUCT_OF", evidence: "GitHub Copilot is a Microsoft product." },
  { from: "veo-3", to: "google-deepmind", kind: "PRODUCT_OF", evidence: "Veo is a Google DeepMind video model." },
  { from: "cursor", to: "openai", kind: "DEPENDS_ON", evidence: "Cursor is a coding product that routes work through frontier models." },
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
