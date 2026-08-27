export const brand = {
  productName: "Article.fm",
  tagline: "News around things, not articles.",
  title: "Article.fm — news around things, not articles",
  siteUrl: process.env.SITE_URL ?? "https://article.fm",
  description:
    "Living topics with claims, sources, and disagreements — not rewritten articles.",
} as const;

export type Brand = typeof brand;
