"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" onClick={onPlay} disabled={loading}>
        {loading ? "Loading" : playing ? "Pause" : `Play · ~${minutes} min`}
      </Button>
      {error ? <span className="text-sm text-muted-foreground">{error}</span> : null}
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}
