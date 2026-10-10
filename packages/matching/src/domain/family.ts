import { type Category, FAMILY_FIELDS } from "@framerate/contracts";
import type { Attributes } from "./attributes";

/** Clave de familia (#101) desde los atributos canónicos; `FAMILY_FIELDS` dice qué campos la forman por categoría. */
export function familyKey(category: Category, attributes: Attributes): string | null {
  const fields = FAMILY_FIELDS[category];
  if (!fields) return null;
  const parts: string[] = [];
  for (const field of fields) {
    const value = attributes[field];
    // Exige todos los campos: un disipador de aire sin radiador no tiene familia (serían 120 en una sola).
    if (value === undefined || value === "") return null;
    parts.push(`${field}=${value}`);
  }
  return `${category}|${parts.join("|")}`;
}
