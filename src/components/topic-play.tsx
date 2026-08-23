"use client";

import { useRef, useState } from "react";

export function TopicPlay({ slug, minutes }: { slug: string; minutes: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    if (!audio.src) {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/topic/${slug}/audio`);
        if (!response.ok) throw new Error("unavailable");
        const blob = await response.blob();
        audio.src = URL.createObjectURL(blob);
      } catch {
        setError("Audio is unavailable.");
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    await audio.play();
    setPlaying(true);
  }

  const label = loading ? "Loading" : playing ? "Pause" : `Play · ~${minutes} min`;

  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <button
        type="button"
        onClick={onPlay}
        disabled={loading}
        aria-pressed={playing}
        className="meta border-b border-rule pb-0.5 text-ink-quiet hover:text-ink disabled:opacity-50"
      >
        {label}
      </button>
      {error ? <span className="meta">{error}</span> : null}
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}
