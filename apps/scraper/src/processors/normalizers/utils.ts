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
 * Normalización genérica (solo limpieza básica)
 */
export function normalizeGenericTitle(title: string): string {
  return cleanHtmlEntities(title);
}
