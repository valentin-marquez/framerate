import { z } from "zod";
import { SPEC_FILTER_PATTERN } from "./facet-definitions";

export * from "./facet-definitions";

/**
 * Filtro en la URL y en la API: `spec=<clave>:<valor>`, repetible. Varios valores de una clave son OR; claves
 * distintas, AND. Ej.: `?spec=vram:12&spec=vram:16&spec=chipset:rtx 5070`.
 */
export const SpecFilterSchema = z
  .string()
  .regex(SPEC_FILTER_PATTERN)
  .transform((raw) => {
    const at = raw.indexOf(":");
    return { key: raw.slice(0, at), value: raw.slice(at + 1) };
  });
export type SpecFilter = z.output<typeof SpecFilterSchema>;

export const FacetValueSchema = z.object({
  value: z.string(),
  label: z.string(),
  /** Productos con stock con este valor (con los demás filtros de la consulta aplicados, sin el de esta faceta). */
  count: z.number().int().nonnegative(),
});
export type FacetValue = z.infer<typeof FacetValueSchema>;

export const FacetSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** Filtro de un solo valor que cumple ese valor o más (`min`) o menos (`max`); sus conteos son acumulados. */
  threshold: z.enum(["min", "max"]).optional(),
  values: z.array(FacetValueSchema),
  /** Productos con stock sin este dato: aparecen al final si se filtra por la faceta. */
  unknownCount: z.number().int().nonnegative(),
});
export type Facet = z.infer<typeof FacetSchema>;

export const FacetListSchema = z.object({ items: z.array(FacetSchema) });
export type FacetList = z.infer<typeof FacetListSchema>;
