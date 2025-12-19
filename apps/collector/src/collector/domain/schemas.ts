import { z } from "zod";

// Helper that trims and requires at least one char
const cleanString = z.string().trim().min(1);

export const ScrapedProductSchema = z.object({
  url: z.string().url(),
  title: cleanString,

  // price can be string or number from scrapers, allow coercion and nullable
  price: z.coerce.number().nonnegative().nullable().optional(),
  originalPrice: z.coerce.number().nonnegative().nullable().optional(),

  stock: z.boolean(),
  stockQuantity: z.coerce.number().int().nonnegative().nullable().optional(),

  mpn: z.string().trim().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),

  // Specs are dynamic but should be a record of string -> string|number
  specs: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export type ScrapedProduct = z.infer<typeof ScrapedProductSchema>;
