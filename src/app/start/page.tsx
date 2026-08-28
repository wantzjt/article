import type { Metadata } from "next";
import { StartPicker } from "@/components/start-picker";
import { currentUser } from "@/lib/auth/current-user";
import { isPublicTopicStatus } from "@/lib/compiler/promotion";
import { compileBlocked } from "@/lib/compiler/compile-priority";
import { getGraph } from "@/lib/store/json-store";

export const metadata: Metadata = { title: "Build my Frequency" };
export const dynamic = "force-dynamic";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ topics?: string }>;
}) {
  const user = await currentUser();
  const params = await searchParams;
  const graph = await getGraph();
  const catalog = graph.topics
    .filter((topic) => isPublicTopicStatus(topic.status) && !compileBlocked(topic.slug))
    .map((topic) => ({ slug: topic.slug, name: topic.name }));
  const allowed = new Set(catalog.map((row) => row.slug));
  const initial = (params.topics ?? "")
    .split(",")
    .map((row) => row.trim())
    .filter((row) => allowed.has(row));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="kicker">Your Frequency</p>
        <h1 className="display">What do you want closer?</h1>
        <p className="text-[0.9375rem] leading-6">
          Follow one or more Topics. Search if the suggestions are not what you need, or skip and browse first.
        </p>
      </header>
      <StartPicker signedIn={Boolean(user)} initial={initial} catalog={catalog} />
    </div>
  );
}
