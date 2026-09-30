import { RESERVED_USERNAMES } from "@framerate/contracts";
import { collapseWhitespace, fold } from "@framerate/kit";

/**
 * Generación de handles públicos. Los proveedores OAuth entregan nombres con
 * mayúsculas, puntos, tildes o espacios; el handle se deriva SIEMPRE en el
 * servidor a un formato fijo (`[a-z0-9_]{3,24}`) y nunca se copia crudo.
 */

const MIN_LENGTH = 3;
const MAX_LENGTH = 24;

/** Forma canónica de un candidato: ASCII, minúsculas, `_` como separador, 3–24 caracteres. */
export function normalizeUsername(input: string | null | undefined): string {
  let base = fold(input ?? "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (base.length === 0) return "user";
  if (base.length < MIN_LENGTH) base = `user_${base}`;
  return base.slice(0, MAX_LENGTH).replace(/_+$/, "");
}

/**
 * Handle único a partir de un candidato. Si el normalizado está reservado o
 * tomado, agrega un sufijo numérico (`ana_perez_4821`). `isTaken` consulta la
 * base; `random` es inyectable para tests deterministas.
 */
export async function generateUsername(
  candidate: string | null | undefined,
  isTaken: (username: string) => Promise<boolean>,
  random: () => number = Math.random,
): Promise<string> {
  const base = normalizeUsername(candidate);
  if (!RESERVED_USERNAMES.has(base) && !(await isTaken(base))) return base;

  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = String(1000 + Math.floor(random() * 9000));
    const stem = base.slice(0, MAX_LENGTH - suffix.length - 1).replace(/_+$/, "");
    const username = `${stem}_${suffix}`;
    if (!RESERVED_USERNAMES.has(username) && !(await isTaken(username))) return username;
  }
  throw new Error(`No se pudo generar un username único a partir de "${candidate}"`);
}

/** Nombre visible: sin espacios repetidos, máximo 60 caracteres. Vacío si no queda nada útil. */
export function cleanDisplayName(input: string | null | undefined): string {
  return collapseWhitespace(input ?? "").slice(0, 60);
}

/** Parte local del correo, como último recurso para derivar un handle. */
export function emailLocalPart(email: string | null | undefined): string {
  return (email ?? "").split("@")[0] ?? "";
}
