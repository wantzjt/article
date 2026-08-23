import { describe, expect, it } from "vitest";
import { glm53Fixture } from "@/lib/fixture/glm-5-3";
import { assembleTopic } from "@/lib/store/graph";
import { evidenceLabel } from "@/lib/render/topic-view";

describe("evidence language", () => {
  it("prints independent and primary counts, never a percent", () => {
    const topic = glm53Fixture.topics[0];
    const graph = assembleTopic(glm53Fixture, topic);
    const claim = graph.claims.find((row) => row.status === "supported") ?? graph.claims[0];
    const label = evidenceLabel(graph, claim.id);
    expect(label).toMatch(/^\d+ independent · \d+ primary$/);
    expect(label).not.toMatch(/%|confidence/i);
  });
});
