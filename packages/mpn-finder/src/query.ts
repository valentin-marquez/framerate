/**
 * @module mpn-finder/query
 *
 * Limpieza del título de producto antes de usarlo como query de búsqueda web.
 */

/**
 * Ruido que no ayuda a encontrar el producto en una búsqueda web: el sustantivo
 * de categoría ("Procesador"), las frases de marketing ("hasta 5.8Ghz") y
 * algunos adjetivos de relleno. Lo que SÍ identifica al producto —marca,
 * número de modelo, capacidad, socket— se conserva.
 *
 * Sólo se listan sustantivos de categoría que NUNCA forman parte de una marca
 * o modelo (p. ej. "cooler" se omite a propósito: rompería "Cooler Master").
 */
const QUERY_NOISE: RegExp[] = [
  /\bhasta\s*[\d.,]+\s*[gm]hz\b/gi, // claim de velocidad máxima
  /\bprocesador(?:es)?\b/gi,
  /\btarjetas?\s+(?:de\s+video|gr[aá]ficas?)\b/gi,
  /\bmemorias?(?:\s+ram)?\b/gi,
  /\bplacas?\s+madres?\b/gi,
  /\bfuentes?\s+de\s+poder\b/gi,
  /\bgabinetes?\b/gi,
  /\bdiscos?\s+duros?\b/gi,
  /\bdisipador(?:es)?\b/gi,
  /\brefrigeraci[oó]n\s+l[ií]quida\b/gi,
  /\balmacenamiento\b/gi,
  /\b(?:gamer|nuev[oa]|original)\b/gi,
];

/**
 * Limpia un título de producto para usarlo como query de búsqueda web. Saca el
 * ruido (ver {@link QUERY_NOISE}) y normaliza la puntuación/espacios. Si la
 * limpieza dejara una query demasiado corta para ser útil, cae al título
 * original.
 *
 * Es una limpieza paralela a la del matcher del catálogo, pero orientada a
 * maximizar la calidad de la búsqueda, no el score de keywords.
 */
export function cleanSearchQuery(query: string): string {
  let out = query;
  for (const re of QUERY_NOISE) out = out.replace(re, " ");
  out = out
    .replace(/[,;|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return out.length >= 3 ? out : query.trim();
}
