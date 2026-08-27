export const brand = {
  productName: "Article.fm",
  tagline: "Tune the news around you.",
  title: "Article.fm — tune the news around you",
  siteUrl: process.env.SITE_URL ?? "https://article.fm",
  description: "What changed. Why it matters. Where it came from.",
} as const;

export type Brand = typeof brand;
