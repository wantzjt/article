const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_src",
]);

export function canonicalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("empty url");
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }
  const params = [...url.searchParams.entries()].filter(
    ([key]) => !TRACKING_PARAMS.has(key.toLowerCase()),
  );
  params.sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [key, value] of params) url.searchParams.append(key, value);
  let path = url.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/$/, "");
  url.pathname = path || "/";
  return url.toString();
}

export function publisherDomain(raw: string): string {
  try {
    return new URL(canonicalizeUrl(raw)).hostname;
  } catch {
    return "";
  }
}

export function isSameCanonicalUrl(a: string, b: string): boolean {
  try {
    return canonicalizeUrl(a) === canonicalizeUrl(b);
  } catch {
    return false;
  }
}
