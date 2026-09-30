/**
 * SQLite no tiene booleanos ni JSON nativos: se guardan como INTEGER 0/1 y
 * TEXT. Kysely no convierte tipos, así que la conversión es explícita en el
 * borde de cada repositorio con estas funciones.
 */

export type SqlBool = 0 | 1;

export const toBool = (v: number | null | undefined): boolean => v === 1;

export const fromBool = (v: boolean): SqlBool => (v ? 1 : 0);

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export const toJson = (value: unknown): string => JSON.stringify(value ?? null);
