import type { Json } from "./types";

/**
 * Convierte un valor JSON-serializable al tipo `Json` que esperan las APIs de
 * Supabase (insert/update/upsert en columnas `jsonb`).
 *
 * El tipo `Json` es una unión recursiva (`{ [k]: Json | undefined } | Json[] | string | ...`)
 * que TypeScript no puede inferir automáticamente desde:
 *
 *   - tipos de dominio (`ScrapedProduct`, `ProductSpecs`, `ValidationIssue[]`)
 *   - `Record<string, unknown>` u objetos plain
 *
 * Aunque estructuralmente son compatibles. Este helper centraliza el cast
 * `as unknown as Json` en un solo lugar y documenta la intención del caller.
 *
 * No realiza validación en runtime — pasa el valor sin modificar. Sólo úsalo
 * con valores que sabes JSON-serializables (sin funciones, símbolos, BigInt,
 * referencias circulares, etc.).
 */
export function toJson<T>(value: T): Json {
  return value as unknown as Json;
}
