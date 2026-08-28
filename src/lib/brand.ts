export const brand = {
  productName: "article.fm",
  tagline: "Tune the news around you.",
  title: "article.fm — tune the news around you",
  siteUrl: process.env.SITE_URL ?? "https://article.fm",
  description: "What changed. Why it matters. Where it came from.",
  coverageNote: "Starting with AI and technology. Expanding continuously.",
  correctionsEmail: "corrections@article.fm",
} as const;

export type Brand = typeof brand;
