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
  "&reg;": "®",
  "&trade;": "™",
  "&copy;": "©",
  "&deg;": "°",
  "&ordm;": "º",
  "&ordf;": "ª",
  "&bull;": "•",
  "&middot;": "·",
  "&hellip;": "...",
  "&laquo;": "«",
  "&raquo;": "»",
  "&iquest;": "¿",
  "&iexcl;": "¡",
  "&times;": "x",
  "&micro;": "µ",
  "&ndash;": "-",
  "&mdash;": "-",
  "&minus;": "-",
  "&plusmn;": "±",
  "&lsquo;": "'",
  "&rsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
  "&frac12;": "1/2",
  "&sup2;": "²",
};

// `&aacute;`, `&Ntilde;`, `&uuml;`…: la letra más su marca combinada.
const MARKS: Record<string, string> = {
  acute: "\u0301",
  grave: "\u0300",
  tilde: "\u0303",
  uml: "\u0308",
  circ: "\u0302",
};

// Un `&#x110000;` en la ficha haría que `fromCodePoint` lance y tumbe la corrida: se deja tal cual.
const codePoint = (m: string, n: number) => (n <= 0x10ffff ? String.fromCodePoint(n) : m);

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([\da-f]+);/gi, (m, code) => codePoint(m, Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (m, code) => HTML_ENTITIES[m] ?? codePoint(m, Number(code)))
    .replace(/&([a-z])(acute|grave|tilde|uml|circ);/gi, (m, letter: string, mark: string) =>
      MARKS[mark] ? `${letter}${MARKS[mark]}`.normalize("NFC") : m,
    )
    .replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m);
}

export function stripHtml(input: string): string {
  return collapseWhitespace(decodeEntities(input.replace(/<[^>]*>/g, " ")));
}

/**
 * Como `stripHtml`, pero una línea por bloque (`</p>`, `</tr>`, `<br>`…): en las fichas "Clave valor" deja de ser una
 * sola tira. Los saltos de línea del código HTML no cuentan, como en el navegador.
 */
export function htmlLines(input: string): string {
  return textLines(
    decodeEntities(
      input
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
        .replace(/\s+/g, " ")
        .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
        .replace(/<[^>]*>/g, " "),
    ),
  );
}

/** Texto plano a líneas limpias: sin espacios repetidos, sin vacías ni caracteres de ancho cero. */
export function textLines(input: string): string {
  return input
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .split("\n")
    .map(collapseWhitespace)
    .filter(Boolean)
    .join("\n");
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
