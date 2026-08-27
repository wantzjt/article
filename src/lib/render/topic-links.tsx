import Link from "next/link";
import type { ReactNode } from "react";

export type LinkedTopic = { slug: string; name: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function LinkedText({
  text,
  topics,
  skipSlug,
}: {
  text: string;
  topics: LinkedTopic[];
  skipSlug?: string;
}): ReactNode {
  const catalog = [...topics]
    .filter((topic) => topic.slug !== skipSlug && topic.name.trim().length >= 3)
    .sort((a, b) => b.name.length - a.name.length);
  if (catalog.length === 0) return text;
  const pattern = new RegExp(`\\b(${catalog.map((topic) => escapeRegExp(topic.name)).join("|")})\\b`, "g");
  const byName = new Map(catalog.map((topic) => [topic.name.toLowerCase(), topic]));
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const hit = byName.get(match[0].toLowerCase());
    if (hit) {
      nodes.push(
        <Link
          key={`${hit.slug}-${index}`}
          href={`/topic/${hit.slug}`}
          className="underline decoration-rule underline-offset-2 hover:decoration-ink"
        >
          {match[0]}
        </Link>,
      );
    } else {
      nodes.push(match[0]);
    }
    index += 1;
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : text;
}
