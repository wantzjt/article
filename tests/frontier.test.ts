import { describe, expect, it } from "vitest";
import { knownTopicKeys, proposeFrontier, slugifyName } from "@/lib/compiler/frontier";
import { getFrontierSeedEntities } from "@/lib/seed/frontier";
import { getOceanEntities } from "@/lib/seed/broad";
import { emptyGraph } from "@/lib/store/graph";

describe("graph-driven frontier", () => {
  it("accepts catalog entities the graph does not already know", () => {
    const graph = emptyGraph();
    graph.topics.push({
      id: "topic_nvidia",
      slug: "nvidia",
      name: "NVIDIA",
      entityType: "infra",
      kind: "company",
      description: "GPUs.",
      aliases: ["Nvidia"],
      officialDomains: ["nvidia.com"],
      status: "strong",
      createdAt: "t",
      updatedAt: "t",
      lastVerifiedAt: null,
      lastMaterialChangeAt: null,
    });
    graph.sources.push({
      id: "s1",
      canonicalUrl: "https://nvidia.com/blackwell",
      title: "NVIDIA Blackwell and NVLink Fusion with MediaTek",
      publisher: "nvidia.com",
      publisherDomain: "nvidia.com",
      author: null,
      publishedAt: "2026-08-27T00:00:00.000Z",
      retrievedAt: "2026-08-27T00:00:00.000Z",
      sourceType: "official",
      primaryStatus: "primary",
      contentHash: "h",
      evidenceExcerpt: "Blackwell systems use NVLink Fusion. MediaTek is a partner.",
      metadata: { topic_id: "topic_nvidia" },
    });
    const result = proposeFrontier(graph);
    expect(result.accepted.some((row) => row.entity.slug === "nvidia")).toBe(false);
    expect(result.accepted.some((row) => row.entity.slug === "blackwell")).toBe(true);
    expect(result.accepted.some((row) => row.entity.slug === "mediatek")).toBe(true);
    expect(result.edges.some((row) => row.from === "nvidia" && row.to === "blackwell")).toBe(true);
    expect(slugifyName("NVLink Fusion")).toBe("nvlink-fusion");
    expect(knownTopicKeys(graph).has("nvidia")).toBe(true);
  });

  it("loads frontier seeds into the ocean entity list", () => {
    expect(getFrontierSeedEntities().some((row) => row.slug === "robotics")).toBe(true);
    expect(getOceanEntities().some((row) => row.slug === "bis-export-controls")).toBe(true);
    expect(getOceanEntities().some((row) => row.slug === "lisa-su")).toBe(true);
  });
});
