import { z } from "zod";
// hot-reload trigger: zod v4 record fix

export const JobSchema = z.object({
  id: z.string().uuid(),
  mpn: z.string().min(1),
  category: z.string().min(1),
  raw_text: z.string().optional().nullable(),
  normalized_title: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  context: z.any().optional().nullable(),
  attempts: z.number().int().nonnegative().optional(),
  // Pass-through fields available from Collector
  price: z.number().optional().nullable(),
  stock_level: z.number().int().optional().nullable(),
  title: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

export const StrategyResultSchema = z
  .object({
    extracted: z.boolean().optional(),
    processed_at: z.string().optional(),
    mpn: z.string().optional(),
    category: z.string().optional(),
    snippet: z.string().optional(),
    specs: z.record(z.string(), z.any()).optional(),
    // Pass-through fields
    price: z.number().optional(),
    currency: z.string().optional(),
    stock_level: z.number().optional(),
    availability: z.string().optional(),
    url: z.string().optional(),
    title: z.string().optional(),
    imageUrl: z.string().optional(),
  })
  .passthrough();

export type Job = z.infer<typeof JobSchema>;
export type StrategyResult = z.infer<typeof StrategyResultSchema>;
