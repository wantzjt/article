import type { Metadata } from "next";
import { decodeSession } from "@/lib/auth/session";
import { getUserById, setUnsubscribed } from "@/lib/frequency/store";

export const metadata: Metadata = { title: "Unsubscribe" };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const params = await searchParams;
  const session = decodeSession(params.t ?? "");
  const user = session ? await getUserById(session.userId) : null;
  if (user) await setUnsubscribed(user.id, true);

  return (
    <article className="space-y-4">
      <p className="kicker">Desk</p>
      <h1 className="display">Unsubscribe</h1>
      <p className="text-[0.9375rem] leading-6">
        {user
          ? "Morning Frequency email is off for this address. The graph and your follows stay."
          : "That unsubscribe link is invalid or expired."}
      </p>
    </article>
  );
}
