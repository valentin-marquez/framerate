import { z } from "zod";

// Base schema for all hardware components
const BaseHardwareSchema = z.object({
  type: z.enum(["CPU", "GPU", "Motherboard", "RAM", "Storage", "PSU", "Case", "Cooler"]),
  manufacturer: z.string(),
  model: z.string(),
  series: z.string().optional(),
  mpn: z.string().optional(), // Manufacturer Part Number
  ean: z.array(z.string()).optional(), // Multiple EANs possible
  images: z.array(z.string().url()).optional(),
  release_date: z.string().datetime().optional(),
});

// Specific schemas can be added here (e.g. GPUSchema, CPUSchema)
// For now, we use a flexible schema for specifications
export const CanonicalProductSchema = BaseHardwareSchema.extend({
  id: z.string().optional(), // ID is usually metadata (filename), but useful to have in type
  specifications: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
});

export type CanonicalProduct = z.infer<typeof CanonicalProductSchema>;
