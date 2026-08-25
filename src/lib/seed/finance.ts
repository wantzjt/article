import type { SeedEntity } from "@/lib/compiler/types";

/** Bounded finance v1 seeds. Not merged into the night ocean queue. */
export const FINANCE_SEED_ENTITIES: SeedEntity[] = [
  { slug: "sequoia-capital", name: "Sequoia Capital", entityType: "investor", description: "Multi-stage venture firm.", aliases: ["Sequoia"], officialDomains: ["sequoiacap.com", "sequoia.com"] },
  { slug: "andreessen-horowitz", name: "Andreessen Horowitz", entityType: "investor", description: "Venture firm investing in software and AI.", aliases: ["a16z"], officialDomains: ["a16z.com"] },
  { slug: "kleiner-perkins", name: "Kleiner Perkins", entityType: "investor", description: "Venture firm.", aliases: ["KP"], officialDomains: ["kleinerperkins.com"] },
  { slug: "greylock", name: "Greylock", entityType: "investor", description: "Venture firm.", aliases: ["Greylock Partners"], officialDomains: ["greylock.com"] },
  { slug: "bessemer", name: "Bessemer Venture Partners", entityType: "investor", description: "Multi-stage venture firm.", aliases: ["BVP", "Bessemer"], officialDomains: ["bvp.com"] },
  { slug: "quiet-capital", name: "Quiet Capital", entityType: "investor", description: "Early-stage venture firm.", aliases: ["Quiet"], officialDomains: ["quiet.com"] },
  { slug: "engineering-capital", name: "Engineering Capital", entityType: "investor", description: "Early-stage firm focused on infrastructure software.", aliases: [], officialDomains: ["engineeringcapital.com"] },
  { slug: "root-ventures", name: "Root Ventures", entityType: "investor", description: "Early-stage firm investing in hard tech and software.", aliases: ["Root"], officialDomains: ["root.vc"] },
  { slug: "floodgate", name: "Floodgate", entityType: "investor", description: "Early-stage venture firm.", aliases: [], officialDomains: ["floodgate.com"] },
  { slug: "afore-capital", name: "Afore Capital", entityType: "investor", description: "Pre-seed and seed firm.", aliases: ["Afore"], officialDomains: ["afore.vc"] },
  { slug: "uncork-capital", name: "Uncork Capital", entityType: "investor", description: "Seed-stage venture firm.", aliases: ["Uncork"], officialDomains: ["uncorkcapital.com"] },
  { slug: "signalfire", name: "SignalFire", entityType: "investor", description: "Data-driven venture firm.", aliases: [], officialDomains: ["signalfire.com"] },
  { slug: "amplify-partners", name: "Amplify Partners", entityType: "investor", description: "Early-stage firm for technical founders.", aliases: ["Amplify"], officialDomains: ["amplifypartners.com"] },
  { slug: "gv", name: "GV", entityType: "investor", description: "Venture arm formerly Google Ventures.", aliases: ["Google Ventures"], officialDomains: ["gv.com"] },
  { slug: "lightspeed", name: "Lightspeed Venture Partners", entityType: "investor", description: "Multi-stage venture firm.", aliases: ["Lightspeed"], officialDomains: ["lsvp.com"] },
  { slug: "openai-funding", name: "OpenAI funding", entityType: "round_event", description: "Publicly reported OpenAI capital events.", aliases: [], officialDomains: ["openai.com", "sec.gov"] },
  { slug: "anthropic-funding", name: "Anthropic funding", entityType: "round_event", description: "Publicly reported Anthropic capital events.", aliases: [], officialDomains: ["anthropic.com", "sec.gov"] },
  { slug: "xai-funding", name: "xAI funding", entityType: "round_event", description: "Publicly reported xAI capital events.", aliases: [], officialDomains: ["x.ai", "sec.gov"] },
  { slug: "databricks-funding", name: "Databricks funding", entityType: "round_event", description: "Publicly reported Databricks capital events.", aliases: [], officialDomains: ["databricks.com", "sec.gov"] },
  { slug: "coreweave-funding", name: "CoreWeave funding", entityType: "round_event", description: "Publicly reported CoreWeave capital events.", aliases: [], officialDomains: ["coreweave.com", "sec.gov"] },
  { slug: "mistral-funding", name: "Mistral AI funding", entityType: "round_event", description: "Publicly reported Mistral capital events.", aliases: [], officialDomains: ["mistral.ai", "sec.gov"] },
];

export const FINANCE_SEED_SLUGS = FINANCE_SEED_ENTITIES.map((row) => row.slug);
