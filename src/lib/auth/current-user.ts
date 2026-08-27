import { readSession } from "./session";
import { getProfile, getUserById, type FrequencyUser } from "@/lib/frequency/store";
import type { FrequencyProfile } from "@/lib/frequency/rank";

export async function currentUser(): Promise<FrequencyUser | null> {
  const session = await readSession();
  if (!session) return null;
  return getUserById(session.userId);
}

export async function currentProfile(): Promise<{ user: FrequencyUser; profile: FrequencyProfile } | null> {
  const user = await currentUser();
  if (!user) return null;
  const profile = await getProfile(user.id);
  if (!profile) return null;
  return { user, profile };
}
