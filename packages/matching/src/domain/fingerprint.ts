import type { Category } from "@framerate/contracts";
import { fold } from "@framerate/kit";
import { type Attributes, PROFILES } from "./attributes";
import { canonicalBrand, detectBrand } from "./brands";
import { normalizeGtin, normalizeMpn } from "./identifiers";

/**
 * Huella de un producto: todo lo que el matching necesita para decidir si dos
 * ofertas son el mismo producto. Se construye igual para una oferta nueva y
 * para un producto existente, así la comparación es simétrica.
 */
export interface Fingerprint {
  category: Category;
  brand: string | null;
  mpn: string | null;
  gtin: string | null;
  attributes: Attributes;
  /** Clave determinística (null si faltan atributos de la clave). */
  attributeKey: string | null;
  /**
   * Tokens que distinguen el modelo (línea, serie, color). Excluye la marca y,
   * en categorías con atributos, los tokens numéricos (32gb, 6000mhz, 4070) y de tipo de memoria (ddr5):
   * esos ya se comparan como atributos y contarlos de nuevo inflaría la similitud.
   */
  tokens: string[];
}

export interface FingerprintInput {
  category: Category;
  title: string;
  brand?: string | null;
  mpn?: string | null;
  gtin?: string | null;
}

export function buildFingerprint(input: FingerprintInput): Fingerprint {
  const brand = canonicalBrand(input.brand) ?? detectBrand(input.title);
  const attributes = PROFILES[input.category].extract(input.title);
  return {
    category: input.category,
    brand,
    mpn: normalizeMpn(input.mpn),
    gtin: normalizeGtin(input.gtin),
    attributes,
    attributeKey: attributeKey(input.category, brand, attributes),
    tokens: distinctiveTokens(input.category, input.title, brand),
  };
}

/**
 * "gpu|asus|rtx 4070 super|12|dual|true". Requiere marca y todos los
 * `keyFields`; si falta algo devuelve null (mejor sin clave que una clave
 * incompleta que junte productos distintos).
 */
export function attributeKey(category: Category, brand: string | null, attributes: Attributes): string | null {
  const { keyFields } = PROFILES[category];
  if (keyFields.length === 0 || !brand) return null;
  const parts: string[] = [category, fold(brand)];
  for (const field of keyFields) {
    const value = attributes[field];
    if (value === undefined) return null;
    parts.push(String(value));
  }
  return parts.join("|");
}

/** Palabras de relleno que no ayudan a distinguir productos. */
const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "con",
  "para",
  "en",
  "sin",
  "a",
  "the",
  "and",
  "with",
  "for",
  "pc",
  "gamer",
  "gaming",
  "tarjeta",
  "video",
  "grafica",
  "memoria",
  "ram",
  "procesador",
  "disco",
  "solido",
  "fuente",
  "poder",
  "placa",
  "madre",
  "gabinete",
  "ventilador",
  "nuevo",
  "original",
  "oferta",
  "envio",
  "gratis",
  "geforce",
  "radeon",
  "nvidia",
  "edition",
]);

function distinctiveTokens(category: Category, title: string, brand: string | null): string[] {
  const brandTokens = new Set(brand ? titleTokens(brand) : []);
  const hasAttributes = PROFILES[category].keyFields.length > 0;
  // "ddr5"/"gddr7" también son atributos (tipo de memoria): contarlos inflaría la similitud igual que los números.
  return titleTokens(title).filter((t) => !brandTokens.has(t) && !(hasAttributes && /^(\d|g?ddr\d)/.test(t)));
}

export function titleTokens(title: string): string[] {
  const tokens = fold(title)
    .replace(/[^a-z0-9+]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return [...new Set(tokens)];
}
