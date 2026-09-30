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
