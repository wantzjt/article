export const brand = {
  productName: "Article.fm",
  tagline: "News around things, not articles.",
  siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
  description:
    "Canonical topics, atomic claims, and the sources that support or dispute them.",
} as const;

export type Brand = typeof brand;
