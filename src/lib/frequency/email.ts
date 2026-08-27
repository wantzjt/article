import { brand } from "@/lib/brand";
import { changeKindLabel } from "@/lib/compiler/change-engine";
import { changeCopy } from "./changes";
import type { RankedChange } from "./rank";

export const MORNING_MIN = 5;
export const MORNING_MAX = 8;

export function morningRows(ranked: RankedChange[]): RankedChange[] {
  if (ranked.length <= MORNING_MAX) return ranked;
  return ranked.slice(0, MORNING_MAX);
}

export function unsubscribeUrl(token: string): string {
  return `${brand.siteUrl}/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function renderMorningFrequencyHtml(input: {
  email: string;
  dateLabel: string;
  rows: RankedChange[];
  unsubUrl: string;
}): string {
  const items = input.rows
    .map((row) => {
      const href = `${brand.siteUrl}/topic/${row.slug}#what-changed`;
      const line = changeCopy(row);
      const tag = row.changeKind
        ? changeKindLabel(row.changeKind)
        : row.breakthrough
          ? "material interrupt"
          : row.facetChild
            ? `${row.facet} / ${row.facetChild}`
            : row.facet;
      const source = row.sourceUrl
        ? `<div style="margin-top:6px;font-family:ui-monospace,monospace;font-size:12px;"><a href="${escapeHtml(row.sourceUrl)}" style="color:#7a7266;">${escapeHtml(row.sourceDomain ?? "source")}</a></div>`
        : "";
      return `<tr>
        <td style="padding:14px 0;border-top:1px solid #e6e0d4;font-family:Georgia,serif;">
          <a href="${href}" style="color:#2c2418;text-decoration:none;font-size:17px;">${escapeHtml(row.name)}</a>
          <div style="margin-top:4px;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7a7266;">${escapeHtml(tag)}</div>
          <div style="margin-top:6px;font-size:15px;line-height:1.45;color:#2c2418;">${escapeHtml(line)}</div>
          ${source}
        </td>
      </tr>`;
    })
    .join("");

  const body =
    input.rows.length === 0
      ? `<p style="font-size:15px;line-height:1.5;color:#2c2418;">Nothing in your Frequency moved enough to interrupt you this morning.</p>`
      : `<table width="100%" cellpadding="0" cellspacing="0">${items}</table>`;

  return `<!doctype html>
<html>
<body style="margin:0;background:#f7f3ea;color:#2c2418;">
  <div style="max-width:40rem;margin:0 auto;padding:28px 20px;font-family:Georgia,serif;">
    <p style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7a7266;">Your Frequency</p>
    <h1 style="font-size:28px;line-height:1.2;font-weight:normal;margin:8px 0 6px;">${escapeHtml(input.dateLabel)}</h1>
    <p style="font-size:15px;line-height:1.5;color:#5c564c;">What changed in the Topics you follow.</p>
    ${body}
    <p style="margin-top:28px;font-size:12px;line-height:1.5;color:#7a7266;">
      Sent to ${escapeHtml(input.email)}.
      <a href="${input.unsubUrl}" style="color:#7a7266;">Unsubscribe</a>.
      Claims stay on the dossier.
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
