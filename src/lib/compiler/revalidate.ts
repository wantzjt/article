export async function revalidateTopicSurfaces(slug: string): Promise<void> {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/");
    revalidatePath(`/topic/${slug}`);
  } catch {
    // CLI ocean runner is not a Next request; pages are force-dynamic on Neon.
  }
}
