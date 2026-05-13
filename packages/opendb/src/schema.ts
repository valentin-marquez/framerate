import { z } from "zod";

// Esquema OpenDB estricto para Hardware
export const OpenDBProductSchema = z.object({
  // Identificadores
  sku: z.string().min(1, "SKU es obligatorio"),
  mpn: z.string().optional(), // Manufacturer Part Number
  ean: z.string().length(13).optional(), // Código de barras estándar

  // Datos Comerciales (Numéricos, nunca strings)
  price: z.number().int().positive("El precio debe ser positivo"),
  currency: z.enum(["CLP", "USD"]).default("CLP"),
  stock_level: z.number().int().min(0).default(0),
  availability: z.enum(["InStock", "OutOfStock", "PreOrder"]).default("OutOfStock"),

  // Metadatos y Especificaciones
  brand: z.string().min(1).default("Unknown"),
  model: z.string().min(1).default("Unknown"),
  // Validación profunda de para especificaciones técnicas
  // Permitimos string | number | boolean para flexibilidad
  specifications: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),

  // Datos de origen
  url: z.string().url(),
  title: z.string().min(1),
  imageUrl: z.string().url().optional(),

  // Auditoría (generados por el sistema, opcionales en la entrada pura)
  last_updated: z.string().datetime().optional(),
});

export type OpenDBProduct = z.infer<typeof OpenDBProductSchema>;
