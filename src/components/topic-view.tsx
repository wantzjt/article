import type { ReactNode } from "react";
import Link from "next/link";
import { StatusChip } from "@/components/status-chip";
import { TopicPlay } from "@/components/topic-play";
import type { ClaimWithEvidence, TopicGraph } from "@/lib/store/graph";
import { evidenceLabel, formatDate, formatTime } from "@/lib/render/topic-view";

const SUPPORT_LABEL = {
  supports: "Supports",
  disputes: "Disputes",
  contextualizes: "Context",
} as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-t border-rule pt-6">
      <h2 className="kicker">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[0.9375rem] leading-6 text-ink-quiet">{children}</p>;
}

function SourceList({ claim }: { claim: ClaimWithEvidence }) {
  return (
    <ul className="mt-3 space-y-3">
      {claim.evidence.map((item) => (
        <li key={`${item.source.id}-${item.supportType}`} className="text-[0.8125rem] leading-5">
          <p className="meta">
            {item.supportType}
            {" · "}
            <a
              className="text-ink underline decoration-rule underline-offset-2 hover:decoration-ink"
              href={item.source.canonicalUrl}
              rel="nofollow noopener"
            >
              {item.source.publisherDomain}
            </a>
          </p>
          <blockquote className="mt-1 text-ink-quiet">{item.evidenceExcerpt}</blockquote>
        </li>
      ))}
    </ul>
  );
}

function ClaimRow({ graph, claim }: { graph: TopicGraph; claim: ClaimWithEvidence }) {
  return (
    <article className="border-b border-rule py-3 last:border-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <StatusChip status={claim.status} />
        <span className="meta">{evidenceLabel(graph, claim.id)}</span>
      </div>
      <p className="claim-sentence mt-2">{claim.claimText}</p>
      {claim.evidence.length > 0 ? (
        <details className="sources mt-2">
          <summary className="meta hover:text-ink">Sources</summary>
          <SourceList claim={claim} />
        </details>
      ) : null}
    </article>
  );
}

function SourcedPositions({ claim }: { claim: ClaimWithEvidence }) {
  const groups = (["supports", "disputes", "contextualizes"] as const)
    .map((supportType) => ({
      supportType,
      items: claim.evidence.filter((item) => item.supportType === supportType),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <article className="border-b border-rule py-3 last:border-0">
      <p className="claim-sentence">{claim.claimText}</p>
      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.supportType}>
            <p className="kicker">{SUPPORT_LABEL[group.supportType]}</p>
            <ul className="mt-2 space-y-3">
              {group.items.map((item) => (
                <li key={`${item.source.id}-${item.supportType}`}>
                  <p className="meta">
                    <a
                      className="text-ink underline decoration-rule underline-offset-2 hover:decoration-ink"
                      href={item.source.canonicalUrl}
                      rel="nofollow noopener"
                    >
                      {item.source.publisherDomain}
                    </a>
                  </p>
                  <p className="mt-1 text-[0.8125rem] leading-5 text-ink-quiet">{item.evidenceExcerpt}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}

export function TopicView({
  graph,
  play,
}: {
  graph: TopicGraph;
  play?: { slug: string; minutes: number } | null;
}) {
  const accepted = graph.claims.filter((claim) => claim.status !== "rejected");
  const disagreements = accepted.filter((claim) => claim.status === "disputed");
  const changedIds = new Set(graph.briefs[0]?.renderData.claimIds ?? []);
  const changed = accepted.filter((claim) => changedIds.has(claim.id));
  const whatChanged = changed.length
    ? changed
    : accepted.filter((claim) => claim.status === "supported").slice(0, 3);
  const stub = graph.topic.status === "stub";
  const indexed = graph.topic.status === "strong";

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="kicker">{graph.topic.entityType}</p>
        <h1 className={stub ? "font-serif text-[1.375rem] leading-7 tracking-tight text-ink-quiet" : "display"}>
          {graph.topic.name}
        </h1>
        <p className={`max-w-prose text-[0.9375rem] leading-6 ${stub ? "text-ink-quiet" : ""}`}>
          {graph.topic.description}
        </p>
        <div className="space-y-2">
          <p className="meta">
            Last verified {formatTime(graph.topic.lastVerifiedAt)}
            {" · "}
            {graph.sources.length} sources
            {" · "}
            {accepted.length} claims
            {" · "}
            <StatusChip status={graph.topic.status} />
          </p>
          {indexed ? null : (
            <p className="meta">
              This topic is {stub ? "a stub" : graph.topic.status} and is not indexed.
            </p>
          )}
          {play ? <TopicPlay slug={play.slug} minutes={play.minutes} /> : null}
        </div>
      </header>

      <Section id="what-changed" title="What Changed">
        {whatChanged.length === 0 ? (
          <Empty>
            {stub
              ? "No compiled claims yet. This topic is a stub."
              : "No material claim movement in the recent window."}
          </Empty>
        ) : (
          whatChanged.map((claim) => <ClaimRow key={claim.id} graph={graph} claim={claim} />)
        )}
      </Section>

      <Section id="evidence" title="Evidence">
        {accepted.length === 0 ? (
          <Empty>No accepted claims on this topic.</Empty>
        ) : (
          accepted.map((claim) => <ClaimRow key={claim.id} graph={graph} claim={claim} />)
        )}
      </Section>

      <Section id="disagreements" title="Disagreements">
        {disagreements.length === 0 ? (
          <Empty>No persisted contradictions.</Empty>
        ) : (
          disagreements.map((claim) => <SourcedPositions key={claim.id} claim={claim} />)
        )}
      </Section>

      <Section id="timeline" title="Timeline">
        {graph.versions.length === 0 ? (
          <Empty>No versions recorded.</Empty>
        ) : (
          <ol className="space-y-5">
            {graph.versions.map((version) => (
              <li key={version.id}>
                <p className="meta">{formatDate(version.createdAt)}</p>
                <p className="mt-1 text-[0.9375rem] leading-6 text-ink">{version.changeSummary}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <p className="meta">
        <Link href={`/topic/${graph.topic.slug}/md`} className="hover:text-ink">
          Markdown
        </Link>
      </p>
    </div>
  );
}
