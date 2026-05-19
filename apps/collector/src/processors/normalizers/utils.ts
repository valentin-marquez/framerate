/**
 * Utilidades Comunes para Normalizadores de Títulos
 *
 * Funciones reutilizables para limpieza y extracción de información
 * de títulos de productos.
 */

/**
 * Limpia caracteres HTML entities y espacios extra
 */
export function cleanHtmlEntities(title: string): string {
  return title
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae la capacidad del título (ej: "8TB", "4 TB", "500GB")
 */
export function extractCapacity(title: string): string | null {
  const tbMatch = title.match(/(\d+)\s*TB/i);
  if (tbMatch) return `${tbMatch[1]}TB`;

  const gbMatch = title.match(/(\d+)\s*GB/i);
  if (gbMatch) return `${gbMatch[1]}GB`;

  return null;
}

/**
 * Extrae el tamaño del disco (ej: "3.5"", "2.5"")
 */
export function extractSize(title: string): string | null {
  const match = title.match(/([23][.,]5)\s*["''"]/i);
  if (match) {
    const size = match[1].replace(",", ".");
    return `${size}"`;
  }

  if (title.toUpperCase().includes("3.5") || title.toUpperCase().includes("3,5")) {
    return '3.5"';
  }
  if (title.toUpperCase().includes("2.5") || title.toUpperCase().includes("2,5")) {
    return '2.5"';
  }

  return null;
}

/**
 * Extrae las RPM del título
 */
export function extractRpm(title: string): string | null {
  const match = title.match(/(\d{4,5})\s*RPM/i);
  if (match) return `${match[1]}RPM`;
  return null;
}

/**
 * Quita ruido de títulos crudos de tienda antes de normalizar:
 *  - segmentos entre paréntesis ("(Ensambladores Mayoristas)", "( S1700 )")
 *  - paréntesis vacíos "()" y paréntesis sueltos/desbalanceados
 *  - separadores colapsados (" - - - " → " ") y guiones/comas al borde
 *
 * Pensado para datos sucios (p.ej. MyShop, cuyo `nombre` trae "Marca () Modelo"
 * y paréntesis sin cerrar). NO toca corchetes: el sufijo "[MPN]" lo agrega el
 * pipeline aguas abajo a propósito.
 */
export function stripVendorNoise(title: string): string {
  let out = title;

  // Quitar contenido entre paréntesis de forma iterativa (maneja anidados
  // simples y múltiples grupos en el mismo título).
  let prev: string;
  do {
    prev = out;
    out = out.replace(/\([^()]*\)/g, " ");
  } while (out !== prev);

  out = out
    .replace(/[()]/g, " ") // paréntesis sueltos restantes
    .replace(/\s*-\s*(?:-\s*)+/g, " - ") // " - - - " → " - "
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([-,])\s*$/g, "") // guion/coma colgando al final
    .replace(/^[\s\-,]+|[\s\-,]+$/g, "") // bordes
    .replace(/\s{2,}/g, " ")
    .trim();

  return out;
}

/**
 * Normalización genérica (solo limpieza básica)
 */
export function normalizeGenericTitle(title: string): string {
  return cleanHtmlEntities(title);
}
