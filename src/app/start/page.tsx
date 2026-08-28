import type { Metadata } from "next";
import { InterestStudio } from "@/components/interest-studio";
import { currentUser } from "@/lib/auth/current-user";
import { liveInterestNodes, parseInterestQuery } from "@/lib/frequency/interests";
import { getGraph } from "@/lib/store/json-store";

export const metadata: Metadata = { title: "Build my Frequency" };
export const dynamic = "force-dynamic";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ topics?: string; nodes?: string }>;
}) {
  const user = await currentUser();
  const params = await searchParams;
  const graph = await getGraph();
  const nodes = liveInterestNodes(graph, new Date());
  const initial = parseInterestQuery(params.nodes);
  for (const slug of (params.topics ?? "").split(",")) {
    const id = nodes.find((node) => node.slug === slug.trim())?.id;
    if (id && initial[id] === undefined) initial[id] = 2;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="kicker">Your Frequency</p>
        <h1 className="display">What do you want closer?</h1>
        <p className="text-[0.9375rem] leading-6">Tap anything that matters to you. You can tune it later.</p>
      </header>
      <InterestStudio signedIn={Boolean(user)} initial={initial} nodes={nodes} />
    </div>
  );
}
