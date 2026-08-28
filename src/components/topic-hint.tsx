"use client";

import { useEffect, useState } from "react";

const KEY = "afm_topic_hint";

export function TopicHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "1") return;
    } catch {
      return;
    }
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // private mode
    }
    setShow(false);
  }

  return (
    <p className="text-[0.9375rem] leading-6">
      Click any claim to see its evidence or ask about it.{" "}
      <button type="button" onClick={dismiss} className="font-mono text-[12px]/[16px] text-ink-quiet hover:text-ink">
        Got it
      </button>
    </p>
  );
}
