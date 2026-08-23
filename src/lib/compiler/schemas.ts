import { z } from "zod";

export const candidateClaimSchema = z.object({
  claimText: z.string().min(8).max(400),
  sourceId: z.string().min(1),
  evidenceExcerpt: z.string().min(12).max(800),
  dates: z.array(z.string()).default([]),
  numbers: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
});

export const extractOutputSchema = z.object({
  claims: z.array(candidateClaimSchema).max(24),
});

export const verifyOutputSchema = z.object({
  verdict: z.enum(["supported", "not_supported"]),
  reason: z.string().min(4).max(400),
});

export const contradictionOutputSchema = z.object({
  pairs: z
    .array(
      z.object({
        aIndex: z.number().int().nonnegative(),
        bIndex: z.number().int().nonnegative(),
        reason: z.string().min(4).max(400),
      }),
    )
    .default([]),
});

export const renderOutputSchema = z.object({
  description: z.string().min(12).max(400),
  whatChanged: z
    .array(
      z.object({
        claimId: z.string(),
        summary: z.string().min(8).max(240),
      }),
    )
    .default([]),
});

export const clusterOutputSchema = z.object({
  groups: z
    .array(
      z.object({
        representativeIndex: z.number().int().nonnegative(),
        memberIndexes: z.array(z.number().int().nonnegative()).min(1),
      }),
    )
    .default([]),
});
