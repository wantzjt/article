"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Restream when Frequency order changes. Never looks like a factual update. */
export function FrequencyList({
  orderKey,
  children,
}: {
  orderKey: string;
  children: ReactNode;
}) {
  const prev = useRef("");
  const [restream, setRestream] = useState(false);

  useEffect(() => {
    if (prev.current && prev.current !== orderKey) {
      setRestream(true);
      const timer = window.setTimeout(() => setRestream(false), 900);
      prev.current = orderKey;
      return () => window.clearTimeout(timer);
    }
    prev.current = orderKey;
    return undefined;
  }, [orderKey]);

  return (
    <div data-frequency-order={orderKey} className={restream ? "frequency-restream" : undefined}>
      {restream ? <p className="meta mt-2">Your Frequency reordered. The underlying claims did not change.</p> : null}
      {children}
    </div>
  );
}
