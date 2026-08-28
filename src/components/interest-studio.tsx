"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { encodeInterestQuery, interestById, type LiveInterestNode } from "@/lib/frequency/interest-tree";

const CARE: Array<{ label: "Less" | "Normal" | "More"; weight: number }> = [
  { label: "Less", weight: -2 },
  { label: "Normal", weight: 0 },
  { label: "More", weight: 2 },
];

export function InterestStudio({
  signedIn,
  initial,
  nodes,
}: {
  signedIn: boolean;
  initial: Record<string, number>;
  nodes: LiveInterestNode[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"discover" | "list">("discover");
  const [view, setView] = useState<string | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>(() => ({ ...initial }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const applied = useRef(false);
  const byId = useMemo(() => new Map(nodes.map((row) => [row.id, row])), [nodes]);

  const visible = nodes.filter((row) => {
    if (!row.present && row.kind !== "area") return false;
    if (view == null) return row.parent == null;
    return row.parent === view;
  });

  function setWeight(id: string, weight: number | null) {
    setWeights((current) => {
      const next = { ...current };
      if (weight === null) delete next[id];
      else next[id] = weight;
      return next;
    });
  }

  function open(id: string) {
    const node = byId.get(id);
    if (!node) return;
    const kids = nodes.filter((row) => row.parent === id && (row.present || row.kind === "area"));
    if (kids.length > 0) {
      if (weights[id] === undefined) setWeight(id, 2);
      setView(id);
      return;
    }
    setWeight(id, weights[id] === undefined ? 2 : null);
  }

  async function commit(nextWeights: Record<string, number>) {
    setPending(true);
    setError(null);
    const encoded = encodeInterestQuery(nextWeights);
    try {
      const response = await fetch("/api/frequency/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights: nextWeights }),
      });
      if (response.status === 401) {
        router.push(`/signin?next=${encodeURIComponent(`/start?nodes=${encoded}`)}`);
        return;
      }
      if (!response.ok) {
        setError("Could not save that Frequency. Try again.");
        return;
      }
      router.replace("/?welcome=1");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (applied.current) return;
    if (signedIn && Object.keys(initial).length > 0) {
      applied.current = true;
      void commit(initial);
    }
  }, [signedIn, initial]);

  function onContinue() {
    if (Object.keys(weights).length === 0) {
      setError("Tap anything that matters, or skip and browse first.");
      return;
    }
    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent(`/start?nodes=${encodeInterestQuery(weights)}`)}`);
      return;
    }
    setSettling(true);
    window.setTimeout(() => void commit(weights), 480);
  }

  const crumbs: LiveInterestNode[] = [];
  let cursor = view;
  while (cursor) {
    const node = byId.get(cursor);
    if (!node) break;
    crumbs.unshift(node);
    cursor = node.parent;
  }

  const selectedNames = Object.keys(weights)
    .map((id) => byId.get(id)?.name ?? interestById(id)?.name)
    .filter(Boolean);

  return (
    <div className={`space-y-5 ${settling ? "interest-settle" : ""}`}>
      <div className="flex items-baseline gap-4">
        <button
          type="button"
          aria-pressed={mode === "discover"}
          onClick={() => setMode("discover")}
          className={`font-mono text-[12px]/[16px] ${mode === "discover" ? "border-b border-ink text-ink" : "text-ink-quiet hover:text-ink"}`}
        >
          Discover
        </button>
        <button
          type="button"
          aria-pressed={mode === "list"}
          onClick={() => setMode("list")}
          className={`font-mono text-[12px]/[16px] ${mode === "list" ? "border-b border-ink text-ink" : "text-ink-quiet hover:text-ink"}`}
        >
          List
        </button>
      </div>

      {mode === "discover" ? (
        <div>
          {crumbs.length > 0 ? (
            <p className="meta mb-2">
              <button type="button" className="hover:text-ink" onClick={() => setView(crumbs.length > 1 ? crumbs[crumbs.length - 2].id : null)}>
                ← {crumbs.map((row) => row.name).join(" / ")}
              </button>
            </p>
          ) : null}
          <InterestField nodes={visible} weights={weights} settling={settling} onOpen={open} />
        </div>
      ) : (
        <InterestList nodes={nodes} weights={weights} onSet={setWeight} />
      )}

      {selectedNames.length > 0 ? (
        <p className="text-[0.9375rem] leading-6">Closer: {selectedNames.join(", ")}.</p>
      ) : null}

      <div className="flex flex-wrap items-baseline gap-6">
        <button
          type="button"
          disabled={pending}
          onClick={onContinue}
          className="inline-flex min-h-11 items-center border-b border-ink font-mono text-[12px]/[16px] text-ink disabled:opacity-50"
        >
          {pending ? "Building" : "Continue"}
        </button>
        <Link href="/explore" className="font-mono text-[12px]/[16px] text-ink-quiet hover:text-ink">
          Skip and browse
        </Link>
      </div>
      {error ? <p className="text-[0.9375rem] leading-6 text-status-disputed">{error}</p> : null}
      <p className="meta">Selecting an area cares about it. It does not follow every Topic underneath.</p>
    </div>
  );
}

function InterestField({
  nodes,
  weights,
  settling,
  onOpen,
}: {
  nodes: LiveInterestNode[];
  weights: Record<string, number>;
  settling: boolean;
  onOpen: (id: string) => void;
}) {
  const slots = layout(nodes.length);
  const selected = nodes.filter((row) => weights[row.id] !== undefined);
  return (
    <div className="interest-field relative h-[22rem] overflow-hidden">
      {nodes.map((node, index) => {
        const slot = slots[index] ?? { x: 50, y: 50 };
        const on = weights[node.id] !== undefined;
        const size = 4.1 + node.activity * 3.4;
        const settleSlot =
          settling && on && selected.length > 0
            ? { x: 18 + (selected.indexOf(node) / Math.max(selected.length, 1)) * 64, y: 18 }
            : slot;
        return (
          <button
            key={node.id}
            type="button"
            aria-pressed={on}
            onClick={() => onOpen(node.id)}
            className={`interest-bubble absolute flex items-center justify-center rounded-full border text-center font-heading leading-5 tracking-tight ${
              on ? "interest-bubble-on" : ""
            } ${node.moving ? "interest-bubble-live" : ""} ${node.childMoving ? "interest-bubble-kids" : ""}`}
            style={{
              width: `${size}rem`,
              height: `${size}rem`,
              left: `${settleSlot.x}%`,
              top: `${settleSlot.y}%`,
              marginLeft: `${-size / 2}rem`,
              marginTop: `${-size / 2}rem`,
              fontSize: size > 6.5 ? "1.05rem" : "0.92rem",
              animationDelay: `${-index * 1.6}s`,
              transition: settling ? "left 480ms ease, top 480ms ease" : undefined,
            }}
          >
            {node.name}
          </button>
        );
      })}
    </div>
  );
}

function InterestList({
  nodes,
  weights,
  onSet,
}: {
  nodes: LiveInterestNode[];
  weights: Record<string, number>;
  onSet: (id: string, weight: number | null) => void;
}) {
  const areas = nodes.filter((row) => row.parent == null);
  return (
    <ul className="space-y-4">
      {areas.map((area) => {
        const clusters = nodes.filter((row) => row.parent === area.id);
        return (
          <li key={area.id}>
            <ListRow node={area} weight={weights[area.id]} onSet={onSet} />
            <ul className="mt-1">
              {clusters.map((cluster) => {
                const topics = nodes.filter((row) => row.parent === cluster.id && row.present);
                return (
                  <li key={cluster.id} className="pl-4">
                    <ListRow node={cluster} weight={weights[cluster.id]} onSet={onSet} />
                    {topics.length > 0 ? (
                      <ul>
                        {topics.map((topic) => (
                          <li key={topic.id} className="pl-4">
                            <ListRow node={topic} weight={weights[topic.id]} onSet={onSet} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function ListRow({
  node,
  weight,
  onSet,
}: {
  node: LiveInterestNode;
  weight: number | undefined;
  onSet: (id: string, weight: number | null) => void;
}) {
  if (node.kind === "topic") {
    const on = weight !== undefined;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => onSet(node.id, on ? null : 2)}
        className={`flex min-h-11 w-full items-center justify-between border-t border-rule text-left ${
          on ? "text-ink" : "text-ink-quiet hover:text-ink"
        }`}
      >
        <span className="font-serif text-[1.0625rem] leading-6">{node.name}</span>
        <span className="meta">{on ? "Following" : "Add"}</span>
      </button>
    );
  }
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-t border-rule">
      <span className={`font-serif text-[1.0625rem] leading-6 ${weight === undefined ? "text-ink-quiet" : "text-ink"}`}>
        {node.name}
      </span>
      <div className="flex gap-3">
        {CARE.map((step) => (
          <button
            key={step.label}
            type="button"
            aria-pressed={weight === step.weight}
            className={`inline-flex min-h-11 items-center font-mono text-[12px]/[16px] ${
              weight === step.weight ? "border-b border-ink text-ink" : "text-ink-quiet hover:text-ink"
            }`}
            onClick={() => onSet(node.id, weight === step.weight ? null : step.weight)}
          >
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function layout(count: number): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 50, y: 48 }];
  const out: Array<{ x: number; y: number }> = [];
  const rx = count > 5 ? 36 : 32;
  const ry = count > 5 ? 30 : 26;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    out.push({ x: 50 + rx * Math.cos(angle), y: 48 + ry * Math.sin(angle) });
  }
  return out;
}
