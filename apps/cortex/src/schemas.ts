import { z } from "zod";

export const JobSchema = z.object({
  id: z.string().uuid(),
  mpn: z.string().min(1),
  category: z.string().min(1),
  raw_text: z.string().optional().nullable(),
  context: z.any().optional().nullable(),
  attempts: z.number().int().nonnegative().optional(),
});

export const StrategyResultSchema = z
  .object({
    extracted: z.boolean().optional(),
    processed_at: z.string().optional(),
    mpn: z.string().optional(),
    category: z.string().optional(),
    snippet: z.string().optional(),
  })
  .passthrough();

export type Job = z.infer<typeof JobSchema>;
export type StrategyResult = z.infer<typeof StrategyResultSchema>;
