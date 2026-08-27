import type { ReactNode } from "react";
import Link from "next/link";
import { FrequencyControls } from "@/components/frequency-controls";
import { GroundedAsk } from "@/components/grounded-ask";
import { StatusChip } from "@/components/status-chip";
import { TopicPlay } from "@/components/topic-play";
import type { Facet } from "@/lib/frequency/facets";
import type { ClaimWithEvidence, TopicGraph } from "@/lib/store/graph";
import { changeKindLabel } from "@/lib/compiler/change-engine";
import { topicKind } from "@/lib/compiler/taxonomy";
import {
  displayDek,
  evidenceLabel,
  formatDate,
  formatRelative,
  formatTime,
  isFreshChange,
  lastRetrievedAt,
  latestEvidence,
  namesAlign,
  personIdentity,
  primaryChangeCopy,
  shortExcerpt,
  warehouseSourceList,
} from "@/lib/render/topic-view";

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

function SourceList({ claim, slug }: { claim: ClaimWithEvidence; slug: string }) {
  return (
    <ul className="mt-1 space-y-3 pb-3">
      {claim.evidence.map((item) => (
        <li key={`${item.source.id}-${item.supportType}`} className="text-[0.8125rem] leading-5">
          <GroundedAsk slug={slug} kind="source" id={item.source.id}>
            <p className="font-mono text-[12px]/[16px] text-ink">
              {item.supportType}
              {" · "}
              <span className="underline decoration-rule underline-offset-2">{item.source.publisherDomain}</span>
            </p>
            <blockquote className="mt-1 text-ink-quiet">{shortExcerpt(item.evidenceExcerpt)}</blockquote>
          </GroundedAsk>
        </li>
      ))}
    </ul>
  );
}

function ClaimRow({
  graph,
  claim,
  changeKind,
}: {
  graph: TopicGraph;
  claim: ClaimWithEvidence;
  changeKind?: string | null;
}) {
  const kind = changeKind ? changeKindLabel(changeKind) : "";
  return (
    <article className="border-b border-rule py-3 last:border-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {kind ? <span className="meta">{kind}</span> : null}
        <StatusChip status={claim.status} />
        <span className="meta">{evidenceLabel(graph, claim.id)}</span>
        {claim.coordinates?.some((row) => row.child) ? (
          <span className="meta">
            {claim.coordinates
              .filter((row) => row.child)
              .map((row) => `${row.facet}/${row.child}`)
              .join(" · ")}
          </span>
        ) : null}
      </div>
      <div className="mt-2">
        <GroundedAsk slug={graph.topic.slug} kind="claim" id={claim.id}>
          <p className="claim-sentence">{claim.claimText}</p>
        </GroundedAsk>
      </div>
      {claim.evidence.length > 0 ? (
        <details className="sources mt-1">
          <summary>Sources</summary>
          <SourceList claim={claim} slug={graph.topic.slug} />
        </details>
      ) : null}
    </article>
  );
}

function SourcedPositions({ graph, claim }: { graph: TopicGraph; claim: ClaimWithEvidence }) {
  const groups = (["supports", "disputes", "contextualizes"] as const)
    .map((supportType) => ({
      supportType,
      items: claim.evidence.filter((item) => item.supportType === supportType),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <article className="border-b border-rule py-3 last:border-0">
      <GroundedAsk slug={graph.topic.slug} kind="disagreement" id={claim.id}>
        <p className="claim-sentence">{claim.claimText}</p>
      </GroundedAsk>
      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.supportType}>
            <p className="kicker">{SUPPORT_LABEL[group.supportType]}</p>
            <ul className="mt-2 space-y-3">
              {group.items.map((item) => (
                <li key={`${item.source.id}-${item.supportType}`}>
                  <p className="font-mono text-[12px]/[16px] text-ink">
                    <a
                      className="underline decoration-rule underline-offset-2 hover:decoration-ink"
                      href={item.source.canonicalUrl}
                      rel="nofollow noopener"
                    >
                      {item.source.publisherDomain}
                    </a>
                  </p>
                  <p className="mt-1 text-[0.8125rem] leading-5 text-ink-quiet">
                    {shortExcerpt(item.evidenceExcerpt)}
                  </p>
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
  frequency,
}: {
  graph: TopicGraph;
  play?: { slug: string; minutes: number } | null;
  frequency?: {
    signedIn: boolean;
    follow: { muted: boolean } | null;
    facets: Partial<Record<Facet, number>>;
  };
}) {
  const accepted = graph.claims.filter((claim) => claim.status !== "rejected");
  const disagreements = accepted.filter((claim) => claim.status === "disputed");
  const typedIds = [...(graph.changes ?? [])]
    .filter(
      (event) =>
        event.claimId &&
        (event.kind === "new" ||
          event.kind === "updated" ||
          event.kind === "confirmed" ||
          event.kind === "disputed" ||
          event.kind === "resolved" ||
          event.kind === "invalidated"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((event) => event.claimId as string);
  const briefIds = (graph.briefs[0]?.renderData.claimIds ?? []).slice(0, 3);
  const changedIds = new Set((typedIds.length ? typedIds : briefIds).slice(0, 3));
  const changed = accepted.filter((claim) => changedIds.has(claim.id));
  const whatChanged = changed;
  const kindByClaim = new Map<string, string>();
  for (const event of [...(graph.changes ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (event.claimId) kindByClaim.set(event.claimId, event.kind);
  }
  const standing = accepted.filter(
    (claim) => !whatChanged.some((row) => row.id === claim.id) && claim.status !== "disputed",
  );
  const stub = graph.topic.status === "stub";
  const hasClaims = accepted.length > 0;
  const identity = personIdentity(graph.topic.entityMeta);
  const identityFits = Boolean(
    identity && (!identity.name || namesAlign(identity.name, graph.topic.name)),
  );
  const kind = topicKind(graph.topic);
  const recent = latestEvidence(graph.sources);
  const remainder = warehouseSourceList(graph.sources, graph.sources.length).slice(recent.length);
  const lastSource = lastRetrievedAt(graph.sources);
  const updatedAt = graph.topic.lastMaterialChangeAt ?? graph.topic.lastVerifiedAt ?? lastSource;
  const affiliation =
    identityFits && identity ? [identity.role, identity.company].filter(Boolean).join(" · ") : "";

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="kicker">{kind}</p>
        <h1 className={stub && graph.sources.length === 0 ? "font-heading text-[1.375rem] leading-7 tracking-tight text-ink-quiet" : "display"}>
          {graph.topic.name}
        </h1>
        {affiliation ? (
          <p className="text-[0.9375rem] leading-6">{affiliation}</p>
        ) : (
          <p className="max-w-prose text-[0.9375rem] leading-6">{displayDek(graph.topic.description)}</p>
        )}
        <p className="meta">
          Updated {formatRelative(updatedAt)}
          {isFreshChange(updatedAt) ? " · New" : ""}
        </p>
        {frequency ? (
          <FrequencyControls
            slug={graph.topic.slug}
            signedIn={frequency.signedIn}
            follow={frequency.follow}
            facets={frequency.facets}
          />
        ) : null}
        {(whatChanged[0] ?? standing[0]) ? (
          <GroundedAsk slug={graph.topic.slug} kind="claim" id={(whatChanged[0] ?? standing[0]).id}>
            <span className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink">
              Ask
            </span>
          </GroundedAsk>
        ) : graph.sources[0] ? (
          <GroundedAsk slug={graph.topic.slug} kind="source" id={graph.sources[0].id}>
            <span className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink">
              Ask
            </span>
          </GroundedAsk>
        ) : null}
        {play ? <TopicPlay slug={play.slug} minutes={play.minutes} /> : null}
      </header>

      {hasClaims ? (
        <>
          <Section id="what-changed" title="What changed">
            {whatChanged.length === 0 ? (
              <Empty>Nothing material moved here just now.</Empty>
            ) : (
              whatChanged.map((claim) => (
                <ClaimRow key={claim.id} graph={graph} claim={claim} changeKind={kindByClaim.get(claim.id)} />
              ))
            )}
          </Section>

          {standing.length > 0 ? (
            <Section id="current-state" title="Current state">
              {standing.slice(0, 8).map((claim) => (
                <ClaimRow key={claim.id} graph={graph} claim={claim} />
              ))}
            </Section>
          ) : null}

          {disagreements.length > 0 ? (
            <Section id="disagreements" title="Disputed / Watching">
              {disagreements.map((claim) => (
                <SourcedPositions key={claim.id} graph={graph} claim={claim} />
              ))}
            </Section>
          ) : null}

          <Section id="timeline" title="Timeline">
            {graph.versions.length === 0 ? (
              <Empty>No earlier changes yet.</Empty>
            ) : (
              <ol className="space-y-5">
                {graph.versions.map((version) => (
                  <li key={version.id}>
                    <p className="meta">{formatDate(version.createdAt)}</p>
                    <GroundedAsk slug={graph.topic.slug} kind="timeline" id={version.id}>
                      <p className="mt-1 text-[0.9375rem] leading-6 text-ink">{primaryChangeCopy(version.changeSummary)}</p>
                    </GroundedAsk>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {graph.sources.length > 0 ? (
            <Section id="sources" title="Sources">
              <details className="sources">
                <summary>Sources</summary>
                <ul className="mt-1 space-y-3 pb-3">
                  {recent.map((source) => (
                    <li key={source.id} className="text-[0.8125rem] leading-5">
                      <p className="text-ink">{source.title}</p>
                      <p className="font-mono text-[12px]/[16px] text-ink">
                        <a
                          className="underline decoration-rule underline-offset-2 hover:decoration-ink"
                          href={source.canonicalUrl}
                          rel="nofollow noopener"
                        >
                          {source.publisherDomain}
                        </a>
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            </Section>
          ) : null}
        </>
      ) : (
        <Section id="sources" title="Sources">
          {graph.sources.length === 0 ? (
            <Empty>Sources still arriving.</Empty>
          ) : (
            <div>
              <p className="meta">Last retrieved {formatTime(lastSource)}</p>
              <ul className="mt-3">
                {recent.map((source) => (
                  <li key={source.id} className="border-t border-rule py-3 first:border-t-0">
                    <GroundedAsk slug={graph.topic.slug} kind="source" id={source.id}>
                      <p className="font-heading text-[1.125rem] leading-6 tracking-tight text-ink">{source.title}</p>
                      <p className="meta mt-1">
                        {source.publisherDomain}
                        {" · "}
                        {formatDate(source.publishedAt ?? source.retrievedAt)}
                      </p>
                    </GroundedAsk>
                    {source.evidenceExcerpt ? (
                      <p className="mt-1 text-[0.8125rem] leading-5 text-ink-quiet">
                        {shortExcerpt(source.evidenceExcerpt, 140)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {remainder.length > 0 ? (
                <details className="sources mt-2">
                  <summary>Sources</summary>
                  <ul className="mt-1 space-y-3 pb-3">
                    {remainder.map((source) => (
                      <li key={source.id} className="text-[0.8125rem] leading-5">
                        <p className="text-ink">{source.title}</p>
                        <p className="font-mono text-[12px]/[16px] text-ink">
                          <a
                            className="underline decoration-rule underline-offset-2 hover:decoration-ink"
                            href={source.canonicalUrl}
                            rel="nofollow noopener"
                          >
                            {source.publisherDomain}
                          </a>
                          {" · "}
                          {formatDate(source.publishedAt ?? source.retrievedAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          )}
        </Section>
      )}

      <p className="meta">
        <Link href={`/topic/${graph.topic.slug}/md`} className="hover:text-ink">
          Markdown
        </Link>
      </p>
    </div>
  );
}
