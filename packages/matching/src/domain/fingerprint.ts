import type { Category, IdentityValue, ListingIdentity } from "@framerate/contracts";
import { fold } from "@framerate/kit";
import { ATTRIBUTE_DEFAULTS, type Attributes, identityAttributeName, PROFILES } from "./attributes";
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
  const brand = resolveBrand(input);
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

export interface IdentityFingerprintInput {
  identity: ListingIdentity;
  /** Códigos del campo de la tienda: el MPN de la tienda gana al impreso. */
  mpn?: string | null;
  gtin?: string | null;
}

/** La misma huella que `buildFingerprint`, desde la identidad anclada por el normalizador: `compare` no distingue. */
export function fingerprintFromIdentity({ identity, mpn, gtin }: IdentityFingerprintInput): Fingerprint {
  const { category, brand } = identity;
  const attributes = attributesFromIdentity(category, identity.identity);
  return {
    category,
    brand,
    mpn: normalizeMpn(mpn) ?? normalizeMpn(identity.mpn),
    gtin: normalizeGtin(gtin),
    attributes,
    attributeKey: attributeKey(category, brand, attributes),
    tokens: distinctiveTokens(category, identity.name, brand),
  };
}

/**
 * Huella de un producto cuya fila es la verdad (creado o completado desde una identidad, spec §5.2): los atributos
 * guardados no se recalculan desde el nombre. Los identificadores los pone quien carga el producto.
 */
export function storedFingerprint(product: {
  category: Category;
  name: string;
  brand: string | null;
  attributes: Attributes;
  attributeKey: string | null;
}): Fingerprint {
  return {
    category: product.category,
    brand: product.brand,
    mpn: null,
    gtin: null,
    attributes: product.attributes,
    attributeKey: product.attributeKey,
    tokens: distinctiveTokens(product.category, product.name, product.brand),
  };
}

// Haiku reparte el mismo nombre entre `model` y `variant` distinto en cada llamada ("crystal z6m floe" contra
// "crystal z6m" + "floe", "vx310" + "argb"), y repite en el texto lo que ya tiene campo propio (RGB, color, OC).
const FREE_TEXT_NOISE = new Set([
  "rgb",
  "argb",
  "oc",
  "black",
  "white",
  "pink",
  "red",
  "blue",
  "gray",
  "green",
  "silver",
]);
// Campo que recibe el texto libre repartido: `variant` se suma a él (gabinete "crystal z6m" + "floe", GPU "gaming" +
// "trio"). Sigue siendo estricto: un token distinto de cualquier lado veta.
const FOLD_INTO: Partial<Record<Category, string>> = {
  case: "model",
  cpu_cooler: "model",
  case_fan: "model",
  gpu: "line",
};

const tokens = (value: IdentityValue | undefined) =>
  typeof value === "string" ? value.split(" ").filter((t) => t && !FREE_TEXT_NOISE.has(t)) : [];

function stableFreeText(category: Category, a: Attributes) {
  const target = FOLD_INTO[category];
  if (!target) return;
  const folded = [...new Set([...tokens(a[target]), ...tokens(a.variant)])].join(" ");
  delete a.variant;
  if (folded) a[target] = folded;
  else delete a[target];
}

/** Nombres de hoy y la política de `attributes.ts` (`ATTRIBUTE_DEFAULTS`, `oc` y `wifi` siempre presentes). */
function attributesFromIdentity(category: Category, identity: Record<string, IdentityValue>): Attributes {
  const a: Attributes = {};
  for (const [field, value] of Object.entries(identity)) a[identityAttributeName(field)] = value;
  stableFreeText(category, a);
  for (const [field, value] of Object.entries(ATTRIBUTE_DEFAULTS[category] ?? {})) a[field] ??= value;
  if (category === "gpu") a.oc ??= false;
  if (category === "motherboard") a.wifi ??= false;
  // Como el extractor: una línea conocida sin "RGB" es la versión sin RGB.
  if (category === "ram" && a.line !== undefined) a.rgb ??= false;
  return a;
}

const CHIP_MAKERS = new Set(["AMD", "NVIDIA", "Intel"]);

/**
 * En GPU y placas la tienda a veces declara el fabricante del chip o otro ensamblador; el del título manda. En el
 * resto se respeta la marca declarada ("XPG Lancer RGB ROG" detectaría ASUS en una RAM).
 */
export function resolveBrand(input: FingerprintInput): string | null {
  const inTitle = detectBrand(input.title);
  const assembled = input.category === "gpu" || input.category === "motherboard";
  if (assembled && inTitle && !CHIP_MAKERS.has(inTitle)) return inTitle;
  const brand = canonicalBrand(input.brand) ?? inTitle;
  // Una placa "AMD" o "Intel" no dice quién la fabrica, y juntaría ensambladores distintos bajo una misma clave.
  return input.category === "motherboard" && brand && CHIP_MAKERS.has(brand) ? null : brand;
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
