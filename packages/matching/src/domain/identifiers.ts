/**
 * Normalización y validación de identificadores duros (MPN y GTIN).
 *
 * Un identificador sólo sirve para fusionar productos si es CONFIABLE. Por eso
 * estas funciones devuelven `null` ante cualquier duda: un MPN ausente sólo
 * hace que el matching use otras señales; un MPN falso fusiona productos
 * distintos (el bug más caro del sistema anterior).
 */

/** Valores basura que las tiendas ponen en el campo SKU/MPN. */
const JUNK_VALUES = new Set(["NA", "N/A", "NONE", "NULL", "SINSKU", "SKU", "0", "-", "GENERICO", "GENERIC"]);

/**
 * Forma canónica de un MPN: mayúsculas, sin espacios, guiones, puntos, barras
 * ni guiones bajos. "DUAL-RTX4070S-O12G" y "dual rtx4070s o12g" → "DUALRTX4070SO12G".
 */
export function normalizeMpn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s\-_./\\#‐-―]+/g, "");
  if (!/^[A-Z0-9]+$/.test(value)) return null;
  if (value.length < 5 || value.length > 40) return null;
  if (JUNK_VALUES.has(value)) return null;
  // Sólo dígitos cortos = id interno de la tienda, no un MPN de fabricante.
  if (/^\d+$/.test(value) && value.length < 8) return null;
  // Sin dígitos = casi seguro una palabra ("PROCESADOR", "GAMER"), no un código.
  if (!/\d/.test(value)) return null;
  return value;
}

/**
 * GTIN-8/12/13/14 (EAN/UPC) con dígito verificador válido, normalizado a 14 dígitos.
 * Si el checksum falla se descarta: suele ser un SKU interno disfrazado.
 */
export function normalizeGtin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  if (/^0+$/.test(digits)) return null;
  if (!hasValidGtinChecksum(digits)) return null;
  return digits.padStart(14, "0");
}

function hasValidGtinChecksum(digits: string): boolean {
  const body = digits.slice(0, -1);
  const check = Number(digits.at(-1));
  let sum = 0;
  // Desde la derecha, los dígitos se ponderan 3,1,3,1...
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10 === check;
}

// Formas explícitas de un código en el título. "P/N" toma hasta el final o el próximo delimitador, porque
// "P/N GM-800B BK" y "P/N GM-800B WH" son productos distintos.
const TITLE_CODE_FORMS = [
  /\[([^[\]]{4,60})\]/g,
  /\b(?:p\s*\/\s*n\s*[:#]?|pn\s*[:#]|part\s*(?:number|no\.?)\s*:?|n[uú]mero de parte\s*:?)\s*([^()[\],|]{4,60})/gi,
  /\(([^()\s]{4,40})\)\s*$/g,
];
const SPEC_CODE =
  /^(\d+X\d+(GB)?|\d+(GB|TB|MB|W|MHZ|GHZ|MM|BITS?|V|MTS|CM|RPM|FANS?|PIN)|(LGA|S|AM|FM|SOCKET|SAM)\d+|G?DDR\d.*|PCIE.*|GEN\d|M2|ATX.*|\d{4})$/;
const CHIP_NAME = /^(RTX|GTX|GT|RX|ARC|[ABHZX])\d{3,4}(TI|XT|XTX|SUPER|GRE|[A-Z])?$/;

/**
 * MPN y GTIN que la tienda escribió en el título ("(CMK16GX5M1D6000Z38)", "P/N AD5U560016G-S",
 * "[PRIME-RX9060XT-O16G]"). Sólo formas explícitas: un código suelto se confunde con el nombre del chip.
 */
export function codesInTitle(title: string): { mpn: string | null; gtin: string | null } {
  let mpn: string | null = null;
  let gtin: string | null = null;
  for (const form of TITLE_CODE_FORMS) {
    for (const match of title.matchAll(form)) {
      for (const piece of (match[1] ?? "").split(/\s+\/\s+/).map((p) => p.trim())) {
        if (/^[\d\s-]+$/.test(piece)) {
          // Un GTIN-8 pasa el checksum por azar 1 de cada 10: en el título sólo EAN/UPC.
          if (piece.replace(/\D/g, "").length >= 12) gtin ??= normalizeGtin(piece);
          continue;
        }
        // Una palabra suelta ("Garantia", "Tarjeta") delata texto de marketing, no un código.
        if (piece.split(/\s+/).some((t) => /^[a-záéíóúñ]{4,}$/i.test(t))) continue;
        const parts = piece.split("/").map((s) => s.toUpperCase().replace(/[\s\-_.]+/g, ""));
        if (parts.some((s) => !/\d/.test(s) || SPEC_CODE.test(s))) continue;
        const value = normalizeMpn(piece);
        if (!value || value.length < 8 || !/[A-Z]/.test(value) || SPEC_CODE.test(value) || CHIP_NAME.test(value))
          continue;
        mpn ??= value;
      }
    }
  }
  return { mpn, gtin };
}
