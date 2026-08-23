import { z } from "zod";

export const extractOutputSchema = z.object({
  claims: z
    .array(
      z.object({
        claim: z.string().min(8).max(400),
        source_id: z.string().min(1),
        evidence_excerpt: z.string().max(800).optional().default(""),
        dates: z.array(z.string()).optional().default([]),
        numbers: z.array(z.string()).optional().default([]),
        entities: z.array(z.string()).optional().default([]),
      }),
    )
    .max(24),
});

export const verifyOutputSchema = z.object({
  verdict: z.enum(["supported", "not_supported"]),
  reason: z.string().min(4).max(400),
});

export const contradictionOutputSchema = z.object({
  pairs: z.array(
    z.object({
      aIndex: z.number().int().nonnegative(),
      bIndex: z.number().int().nonnegative(),
      reason: z.string().min(1).max(400),
    }),
  ),
});

export const renderOutputSchema = z.object({
  description: z.string().min(12).max(400),
  whatChanged: z.array(
    z.object({
      claimId: z.string(),
      summary: z.string().min(1).max(240),
    }),
  ),
});

export const clusterOutputSchema = z.object({
  groups: z.array(
    z.object({
      representativeIndex: z.number().int().nonnegative(),
      memberIndexes: z.array(z.number().int().nonnegative()),
    }),
  ),
});
