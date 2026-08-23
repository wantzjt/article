import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TopicPlay } from "@/components/topic-play";
import type { TopicGraph } from "@/lib/store/graph";
import { evidenceLabel, formatTime } from "@/lib/render/topic-view";

function ClaimBlock({
  graph,
  claimId,
}: {
  graph: TopicGraph;
  claimId: string;
}) {
  const claim = graph.claims.find((row) => row.id === claimId);
  if (!claim || claim.status === "rejected") return null;
  return (
    <article className="space-y-2 border-b border-border py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{claim.status}</Badge>
        <span className="text-xs text-muted-foreground">{evidenceLabel(graph, claim.id)}</span>
      </div>
      <p className="font-serif text-lg leading-snug">{claim.claimText}</p>
      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer">Sources</summary>
        <ul className="mt-2 space-y-2">
          {claim.evidence.map((item) => (
            <li key={`${item.source.id}-${item.supportType}`}>
              <span className="uppercase tracking-wide">{item.supportType}</span>
              {" · "}
              <a className="underline" href={item.source.canonicalUrl} rel="nofollow noopener">
                {item.source.publisherDomain}
              </a>
              <blockquote className="mt-1 border-l pl-3 italic">
                {item.evidenceExcerpt}
              </blockquote>
            </li>
          ))}
        </ul>
      </details>
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
  const whatChanged = changed.length ? changed : accepted.filter((claim) => claim.status === "supported").slice(0, 3);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {graph.topic.entityType}
        </p>
        <h1 className="font-serif text-4xl tracking-tight">{graph.topic.name}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{graph.topic.description}</p>
        <p className="text-sm text-muted-foreground">
          Last verified {formatTime(graph.topic.lastVerifiedAt)} · {graph.sources.length} sources ·{" "}
          {accepted.length} claims · {graph.topic.status}
        </p>
        {play ? <TopicPlay slug={play.slug} minutes={play.minutes} /> : null}
      </header>

      <section id="what-changed">
        <h2 className="text-xs uppercase tracking-[0.2em]">What Changed</h2>
        <Separator className="my-3" />
        {whatChanged.length === 0 ? (
          <p className="text-sm text-muted-foreground">No material claim movement in the recent window.</p>
        ) : (
          whatChanged.map((claim) => <ClaimBlock key={claim.id} graph={graph} claimId={claim.id} />)
        )}
      </section>

      <section id="evidence">
        <h2 className="text-xs uppercase tracking-[0.2em]">Evidence</h2>
        <Separator className="my-3" />
        {accepted.map((claim) => (
          <ClaimBlock key={claim.id} graph={graph} claimId={claim.id} />
        ))}
      </section>

      <section id="disagreements">
        <h2 className="text-xs uppercase tracking-[0.2em]">Disagreements</h2>
        <Separator className="my-3" />
        {disagreements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No persisted contradictions.</p>
        ) : (
          disagreements.map((claim) => (
            <Card key={claim.id} className="mb-4">
              <CardHeader>
                <CardTitle className="font-serif text-xl">{claim.claimText}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {claim.evidence.map((item) => (
                  <p key={`${item.source.id}-${item.supportType}`}>
                    <Badge variant="secondary">{item.supportType}</Badge> {item.source.publisherDomain}:{" "}
                    {item.evidenceExcerpt}
                  </p>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section id="timeline">
        <h2 className="text-xs uppercase tracking-[0.2em]">Timeline</h2>
        <Separator className="my-3" />
        <ol className="space-y-4">
          {graph.versions.map((version) => (
            <li key={version.id}>
              <p className="text-xs text-muted-foreground">{formatTime(version.createdAt)}</p>
              <p className="font-serif">{version.changeSummary}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
