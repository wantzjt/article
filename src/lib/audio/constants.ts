import { LAUNCH_DEMO_SLUG } from "@/lib/seed/entities";

export const TTS_MODEL = process.env.TTS_MODEL ?? "fish-audio/s2.1-pro";
export const TTS_MAX_CHARS = 6000;
export const TTS_ALLOWED_SLUG = LAUNCH_DEMO_SLUG;
export const TTS_PROMO_UNTIL = "2026-09-18";
export const CHARS_PER_MINUTE = 900;

export function estimatedMinutes(characterCount: number): number {
  return Math.max(1, Math.round(characterCount / CHARS_PER_MINUTE));
}

export function isAudioTopic(slug: string): boolean {
  return slug === TTS_ALLOWED_SLUG;
}

export function audioNotAvailableError(slug: string): "audio_not_available" | null {
  return isAudioTopic(slug) ? null : "audio_not_available";
}
