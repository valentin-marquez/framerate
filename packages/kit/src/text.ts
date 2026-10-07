/** Utilidades de texto puras, sin dependencias. */

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#039;": "'",
  "&nbsp;": " ",
  "&#8211;": "-",
  "&#8212;": "-",
  "&#8243;": '"',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (m, code) => HTML_ENTITIES[m] ?? String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m);
}

export function stripHtml(input: string): string {
  return collapseWhitespace(decodeEntities(input.replace(/<[^>]*>/g, " ")));
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/** Minúsculas, sin tildes: forma canónica para comparar texto. */
export function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function slugify(input: string): string {
  return fold(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * Forma canónica para el índice de búsqueda: letras y números se separan cuando las dos partes tienen 2 o más
 * caracteres, así "RTX 5070Ti" y "RTX 5070 Ti" quedan con los mismos tokens. No se separa cuando una parte es de
 * un solo carácter, porque destruiría tokens que sí distinguen productos ("i5", "7800x3d", "b550m", "ddr5").
 * La consulta se normaliza igual (`ftsQuery` en el server): las dos formas de escribirlo encuentran lo mismo.
 */
export function searchText(input: string): string {
  return fold(input)
    .replace(/[^a-z0-9+]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(splitLetterDigit)
    .join(" ");
}

const SEGMENTS = /\d+|[a-z]+|\+/g;

function splitLetterDigit(word: string): string {
  const parts = word.match(SEGMENTS);
  if (!parts) return "";
  return parts.reduce((out, part, i) => {
    const previous = parts[i - 1];
    if (!previous) return part;
    return previous.length > 1 && part.length > 1 ? `${out} ${part}` : out + part;
  }, "");
}
