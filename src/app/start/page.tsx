import type { Metadata } from "next";
import { StartPicker } from "@/components/start-picker";
import { currentUser } from "@/lib/auth/current-user";
import { STARTER_TOPICS } from "@/lib/frequency/starters";

export const metadata: Metadata = { title: "Build my Frequency" };
export const dynamic = "force-dynamic";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ topics?: string }>;
}) {
  const user = await currentUser();
  const params = await searchParams;
  const allowed = new Set<string>(STARTER_TOPICS.map((row) => row.slug));
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
          Follow three to five. You can mute or tune anything later.
        </p>
      </header>
      <StartPicker signedIn={Boolean(user)} initial={initial} />
    </div>
  );
}
