/**
 * Detección de variantes de un mismo producto a partir de sus MPN.
 *
 * Lógica pura (sin I/O) para poder testearla y mantener UNA sola fuente de verdad.
 * El servicio de mantenimiento la consume tras cada scrape para agrupar variantes
 * vía `product_groups` / `products.group_id`.
 *
 * Históricamente esta heurística estaba duplicada en `maintenance.service.ts` y en
 * `packages/db/src/scripts/group-variants.ts`; ambas copias compartían el mismo bug
 * (rechazaban `ICEBURG-240-DIGITAL-WHITE` ↔ `ICEBURG-240-DIGITAL-BK`).
 */

// Tokens de color/acabado comunes en MPNs (palabra completa y abreviaturas usuales).
// Se comparan SIEMPRE como segmento delimitado (entre -, _, /, espacio o extremos),
// nunca como substring, para no romper modelos que contengan estas letras.
export const COLOR_TOKENS = new Set([
  "WHITE",
  "WHT",
  "WH",
  "BLACK",
  "BLK",
  "BK",
  "RED",
  "BLUE",
  "BLU",
  "GREEN",
  "GRN",
  "SILVER",
  "SLV",
  "GREY",
  "GRAY",
  "GRY",
  "PINK",
  "RGB",
  "ARGB",
]);

function splitMpnTokens(mpn: string): string[] {
  return mpn
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

// Tokens de color ordenados por longitud desc para que el prefijo más largo
// gane (e.g. "WHITE" antes que "WH").
const COLOR_TOKENS_BY_LEN = [...COLOR_TOKENS].sort((a, b) => b.length - a.length);

/**
 * ¿El token es de color? Acepta el token exacto ("BK", "WHITE") y también
 * sufijos de color pegados a un sub-código corto del vendor, como
 * "BKCWW" (BK + CWW) / "WHCWW" (WH + CWW) que MyShop usa en sus partno.
 * El remanente se limita a ≤3 alfanuméricos para no tragarse modelos
 * (e.g. "REDUX" no debe contar como "RED").
 */
function isColorToken(token: string): boolean {
  if (COLOR_TOKENS.has(token)) return true;
  for (const c of COLOR_TOKENS_BY_LEN) {
    if (token.length > c.length && token.length - c.length <= 3 && token.startsWith(c)) {
      return true;
    }
  }
  return false;
}

function getCommonPrefix(s1: string, s2: string): string {
  let i = 0;
  while (i < s1.length && i < s2.length && s1[i] === s2[i]) {
    i++;
  }
  return s1.slice(0, i);
}

/**
 * Estrategia de color: dos MPN son variantes si son idénticos salvo por un token
 * de color/acabado. Maneja casos asimétricos (`-WHITE` vs `-BK`) que la estrategia
 * de prefijo común no detecta porque el discriminante puede tener largos muy
 * distintos (palabra completa vs abreviatura). Exige que la base (sin tokens de
 * color) sea idéntica y tenga ≥2 tokens para no agrupar productos distintos que
 * casualmente compartan pocos tokens.
 */
export function isColorVariant(mpn1: string, mpn2: string): boolean {
  const t1 = splitMpnTokens(mpn1);
  const t2 = splitMpnTokens(mpn2);

  const base1 = t1.filter((t) => !isColorToken(t));
  const base2 = t2.filter((t) => !isColorToken(t));

  // Al menos uno debía traer un token de color; si no, no es variante de color.
  const hadColor = base1.length !== t1.length || base2.length !== t2.length;
  if (!hadColor) return false;

  if (base1.length === 0 || base1.length !== base2.length) return false;
  // Exigir ≥2 tokens de base para no agrupar productos distintos que
  // casualmente compartan pocos tokens, SALVO que el único token de base
  // sea largo y específico (e.g. "LEVANTEII240"), no genérico ("X").
  if (base1.length === 1 && base1[0].length < 6) return false;
  return base1.every((tok, i) => tok === base2[i]);
}

/**
 * Decide si dos MPN (de la misma marca) corresponden a variantes del mismo
 * producto. Devuelve `false` si son idénticos (no son "variantes" entre sí).
 */
export function areVariants(mpn1: string, mpn2: string): boolean {
  if (mpn1 === mpn2) return false;

  // Estrategia 0: variante de color/acabado (e.g. ICEBURG-240-DIGITAL-WHITE vs -BK).
  if (isColorVariant(mpn1, mpn2)) return true;

  // Estrategia 1: Prefijo común (variantes de color/empaque cortas: -BLK, -WHT, -RED)
  const commonPrefix = getCommonPrefix(mpn1, mpn2);
  const maxLen = Math.max(mpn1.length, mpn2.length);

  if (maxLen > 5 && commonPrefix.length / maxLen > 0.85) {
    const suffix1 = mpn1.slice(commonPrefix.length);
    const suffix2 = mpn2.slice(commonPrefix.length);

    if (suffix1.length <= 4 && suffix2.length <= 4) {
      return true;
    }
  }

  // Estrategia 2: Variantes de capacidad (storage/RAM: 500G vs 1000G, 8GB vs 16GB, 1TB vs 2TB)
  const capacityPattern = /\d+(?:GB?|TB?)/g;
  if (capacityPattern.test(mpn1)) {
    capacityPattern.lastIndex = 0;
    if (capacityPattern.test(mpn2)) {
      const norm1 = mpn1.replace(/\d+(?:GB?|TB?)/g, "");
      const norm2 = mpn2.replace(/\d+(?:GB?|TB?)/g, "");

      if (norm1.length > 3 && norm1 === norm2) {
        return true;
      }
    }
  }

  return false;
}
