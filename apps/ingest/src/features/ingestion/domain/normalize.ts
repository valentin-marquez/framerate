import { type Category, CategorySchema, NORMALIZER_VERSION, SOURCE_TEXT_MAX } from "@framerate/contracts";
import { collapseWhitespace, decodeEntities, fold } from "@framerate/kit";
import {
  type Attributes,
  buildFingerprint,
  codesInTitle,
  type Fingerprint,
  normalizeGtin,
  normalizeMpn,
  PROFILES,
} from "@framerate/matching";
import { z } from "zod";

/**
 * Lo que un adaptador de tienda entrega por cada oferta. Es el ÚNICO contrato
 * entre el scraping (inestable, específico de cada tienda) y el resto del
 * sistema. Se valida aquí; nada no validado llega a la base.
 */
export const RawOfferSchema = z.object({
  /** Id estable dentro de la tienda (id de API, SKU interno o URL canónica). */
  externalId: z.string().trim().min(1).max(200),
  url: z.url(),
  title: z.string().trim().min(5).max(300),
  category: CategorySchema,
  /** Precio efectivo/transferencia, CLP entero. */
  priceCash: z.number().int().positive(),
  /** Precio normal/tarjeta. null si la tienda publica un único precio. */
  priceCard: z.number().int().positive().nullable(),
  inStock: z.boolean(),
  stockQuantity: z.number().int().nonnegative().nullable(),
  /** Marca declarada por la tienda (atributo), si la hay. */
  brand: z.string().trim().min(1).max(60).nullable(),
  /** Sólo si la tienda publica el código del FABRICANTE (no su SKU interno). */
  mpn: z.string().trim().max(60).nullable(),
  gtin: z.string().trim().max(20).nullable(),
  /** Todas las fotos, la principal primero. */
  imageUrls: z.array(z.url()),
  /** Texto de la ficha (descripción y specs) si la tienda lo entrega sin otro fetch; lo lee el normalizador. */
  sourceText: z.string().nullable().optional(),
});
export type RawOffer = z.infer<typeof RawOfferSchema>;

export interface NormalizedOffer {
  externalId: string;
  url: string;
  title: string;
  rawTitle: string;
  category: Category;
  brand: string | null;
  mpn: string | null;
  gtin: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  priceCash: number;
  priceCard: number;
  inStock: boolean;
  stockQuantity: number | null;
  attributes: Attributes;
  fingerprint: Fingerprint;
  /** Ficha recortada a `SOURCE_TEXT_MAX`. */
  sourceText: string | null;
}

export type NormalizeResult =
  | { ok: true; offer: NormalizedOffer }
  | { ok: false; reason: string; externalId: string | null };

/** Rango de precios plausible por categoría (CLP). Fuera de rango = error de parseo casi seguro. */
const PRICE_RANGE: Record<Category, [min: number, max: number]> = {
  gpu: [40_000, 15_000_000],
  cpu: [25_000, 20_000_000],
  motherboard: [30_000, 5_000_000],
  ram: [8_000, 5_000_000],
  psu: [15_000, 3_000_000],
  ssd: [10_000, 5_000_000],
  hdd: [15_000, 5_000_000],
  cpu_cooler: [2_500, 2_000_000],
  case: [15_000, 3_000_000],
  case_fan: [2_000, 1_000_000],
};

const NOT_NEW =
  /\b(usad[oa]s?|reacondicionad[oa]s?|refurbished|open ?box|caja abierta|caja (mala|danada)|seminuev[oa]s?|segunda mano|outlet)\b/;
const BUNDLE = /\b(combo|bundle|kit (pc|gamer)|pc armad[oa])\b/;
// "Pack de…" o "KIT placa + memoria" juntan productos distintos ("80+ Bronze" y "Xeon 4416+" no llevan " + "), salvo
// en ventiladores: un pack de tres o un kit con controladora es un producto de la categoría.
const MULTI = /\bpack de\b|\b(pack|kit)\b.*\s\+\s/;
// Accesorios que las tiendas meten en cualquier categoría: el título empieza por lo que realmente son.
const ACCESSORY =
  /^(plataforma|soporte|kit de cables|cables?|hub|fan hub|controlador(a)?|adaptador|kit adaptador|kit de montaje|kit para|bracket|pasta|thermal pads?|tira led)\b/;
// Los que no dejan duda en cualquier posición ("Cooler Master-Cable divisor…", "… ARGB 1 TO 5 SPLITTER"): Haiku los
// marcaba `other` y la llamada se pagaba igual (#159). "con Cable Splitter" es lo que trae un ventilador.
const ACCESSORY_ANYWHERE =
  /\b((?<!\bcon (cable )?)splitter|cable divisor|funda|termostato|montaje en rack|bandeja de ventiladores|adaptador (para |de )?(disipador|socket|lga|water ?cooling)|disipador (de calor |aluminio )?(para |de )?(ssd|m\.?2))\b/;
const OTHER_PRODUCT = /\b(notebook|laptop|all in one|monitor|consola|tablet)\b/;
// En RAM y SSD "notebook"/"laptop" suele ser compatibilidad (SO-DIMM, "para PC y Laptop"): sólo cuenta al inicio.
const OTHER_PRODUCT_START = /^(notebook|laptop|all in one|monitor|consola|tablet)\b/;
const FAN_TITLE = /^(ventilador|pack|kit)\b/;
const CPU_COOLER_CUE = /\b(cpu|torre|tower|disipador|heatpipes?|liquid[ao]|aio|water|lga ?\d{4}|am[45])\b/;
const HDD_TITLE = /\b(hdd|lff|ultrastar|ironwolf|skyhawk|exos|barracuda|n300|purple|[57]200 ?rpm|(7\.2|10|15)k)\b/;
const EXTERNAL_DRIVE = /\b(extern[oa]s?|portatil|portable|usb)\b/;

/** Lo que las tiendas meten en la categoría equivocada, con el motivo de lo que realmente es. */
const MISPLACED: Partial<Record<Category, Array<[misplaced: (title: string) => boolean, reason: string]>>> = {
  // Los coolers de CPU dicen CPU, torre, líquida…; un "Ventilador …" sin eso es de gabinete.
  cpu_cooler: [[(t) => FAN_TITLE.test(t) && !CPU_COOLER_CUE.test(t), "category:case_fan"]],
  // Sin torre/tower suelto: los ventiladores dicen "para gabinete Mid Tower".
  case_fan: [
    [
      (t) =>
        /\b(cpu|aio|disipador|heatpipes?|liquid[ao]|water|lga ?\d{4}|am[45])\b|\bair cooler\b|\b(single|dual) tower\b|^refrigeracion liquida/.test(
          t,
        ),
      "category:cpu_cooler",
    ],
  ],
  ssd: [
    [(t) => EXTERNAL_DRIVE.test(t), "category:external_drive"],
    // Discos mecánicos publicados como SSD: Bookcomputer (Ultrastar, WD Purple, N300) y los de servidor (7.2K, 10K, LFF).
    [(t) => HDD_TITLE.test(t) && !/\b(ssd|nvme|m\.?2)\b/.test(t), "category:hdd"],
    [(t) => /\bddr[345]\b|\b(pendrive|micro ?sd|sdxc|sdhc|tarjeta de memoria)\b/.test(t), "category:other_product"],
  ],
  hdd: [
    [(t) => EXTERNAL_DRIVE.test(t), "category:external_drive"],
    [(t) => /\bssd\b/.test(t), "category:ssd"],
  ],
  // Fuentes que la tienda también publica como gabinete: empiezan por "fuente", o no nombran un gabinete y traen
  // potencia y certificación.
  case: [
    [(t) => /^fuente\b/.test(t) || (!/\b(gabinete|case|chasis|torre|tower)\b/.test(t) && isPsu(t)), "category:psu"],
    // Racks de red ("Nexxt 19″ 42U 600×1000", KDTEC): unidades de rack sin formato de placa. Un chasis rackmount
    // ATX sí es un gabinete.
    [(t) => /\b\d{1,2} ?u\b/.test(t) && !/itx|atx/.test(t), "category:other_product"],
  ],
};

function isPsu(title: string): boolean {
  const a = PROFILES.psu.extract(title);
  return a.wattage !== undefined && a.efficiency !== undefined;
}

/** Ruido de marketing que las tiendas meten en el título. */
// Con límites de palabra: "Seminuevo" no debe perder "nuevo".
const TITLE_NOISE = /[¡!]*\s*\b(oferta|nuevo|envio gratis|envío gratis|liquidacion|liquidación|cyber)\b\s*[!¡]*/gi;

export function normalizeOffer(input: unknown, expectedCategory: Category): NormalizeResult {
  const parsed = RawOfferSchema.safeParse(input);
  const externalId = extractExternalId(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, externalId, reason: `schema:${issue?.path.join(".") ?? "?"}:${issue?.code ?? "invalid"}` };
  }
  const raw = parsed.data;
  if (raw.category !== expectedCategory) return { ok: false, externalId, reason: "category:unexpected" };

  const title = cleanTitle(raw.title);
  const folded = fold(title);
  if (NOT_NEW.test(folded)) return { ok: false, externalId, reason: "condition:not_new" };
  if (BUNDLE.test(folded) || (raw.category !== "case_fan" && MULTI.test(folded))) {
    return { ok: false, externalId, reason: "bundle" };
  }
  const otherProduct = raw.category === "ram" || raw.category === "ssd" ? OTHER_PRODUCT_START : OTHER_PRODUCT;
  if (otherProduct.test(folded)) return { ok: false, externalId, reason: "category:other_product" };
  if (ACCESSORY.test(folded) || ACCESSORY_ANYWHERE.test(folded))
    return { ok: false, externalId, reason: "category:other_product" };
  const misplaced = MISPLACED[raw.category]?.find(([test]) => test(folded));
  if (misplaced) return { ok: false, externalId, reason: misplaced[1] };

  // Algunas tiendas invierten los campos: el efectivo siempre es el menor.
  const priceCash = Math.min(raw.priceCash, raw.priceCard ?? raw.priceCash);
  const priceCard = Math.max(raw.priceCash, raw.priceCard ?? raw.priceCash);
  const [min, max] = PRICE_RANGE[raw.category];
  if (priceCash < min || priceCard > max) return { ok: false, externalId, reason: "price:out_of_range" };

  const inTitle = codesInTitle(raw.title);
  const fingerprint = buildFingerprint({
    category: raw.category,
    title,
    brand: raw.brand,
    mpn: normalizeMpn(raw.mpn) ?? inTitle.mpn,
    gtin: normalizeGtin(raw.gtin) ?? inTitle.gtin,
  });
  // Sin compuerta por atributos faltantes (#14): el título que la regex no entiende lo resuelve Haiku, que además
  // marca `other` los accesorios y corrige la categoría.

  return {
    ok: true,
    offer: {
      externalId: raw.externalId,
      url: raw.url,
      title,
      rawTitle: raw.title,
      category: raw.category,
      brand: fingerprint.brand,
      mpn: fingerprint.mpn,
      gtin: fingerprint.gtin,
      imageUrl: raw.imageUrls[0] ?? null,
      imageUrls: raw.imageUrls,
      priceCash,
      priceCard,
      inStock: raw.inStock,
      stockQuantity: raw.inStock ? raw.stockQuantity : 0,
      attributes: fingerprint.attributes,
      fingerprint,
      sourceText: clipSourceText(raw.sourceText?.trim() ?? "") || null,
    },
  };
}

const SPECS_HEADING = /especificaciones|specifications|ficha t[eé]cnica|caracter[ií]sticas t[eé]cnicas/i;
// Menos que esto después del título es un "ver especificaciones" suelto, no la sección.
const SPECS_MIN = 1000;

/**
 * Al tope de caracteres: si la ficha se pasa y tiene una sección de especificaciones, se corta desde ahí. Antes suele ir
 * prosa de marketing (Thundertech, Infor-Ingen: ~1.000 caracteres) y los datos quedaban fuera del recorte.
 */
export function clipSourceText(text: string): string {
  if (text.length <= SOURCE_TEXT_MAX) return text;
  const at = text.search(SPECS_HEADING);
  const from = at > 0 && text.length - at >= SPECS_MIN ? at : 0;
  return text.slice(from, from + SOURCE_TEXT_MAX);
}

export type HashInput = Pick<NormalizedOffer, "category" | "rawTitle" | "brand" | "mpn" | "gtin" | "sourceText">;

/**
 * `listings.norm_hash`: lo que, si cambia, obliga a normalizar de nuevo (spec 2026-10-08 §4). Precio, stock, fotos y
 * URL quedan fuera. Subir `NORMALIZER_VERSION` cambia todos los hashes. El texto de ficha también queda fuera: algunas
 * tiendas lo varían entre corridas (Winpy, Centrale, Notebook Store: ~150 ofertas pagadas varias veces al día en
 * 10-2026). Haiku lo sigue leyendo cuando el título, la marca o los identificadores cambian.
 */
export async function normHash(input: HashInput): Promise<string> {
  return sha256(
    [
      NORMALIZER_VERSION,
      input.category,
      fold(input.rawTitle),
      input.mpn ?? "",
      input.gtin ?? "",
      input.brand ?? "",
    ].join("|"),
  );
}

// ponytail: transición del hash con texto de ficha, para no pagar Haiku otra vez por todo el catálogo. Se borra junto con
// su rama en `upsertListing` cuando ingest haya pasado una vez por todas las tiendas después del deploy.
export async function legacyNormHash(input: HashInput): Promise<string> {
  return sha256(
    [
      NORMALIZER_VERSION,
      input.category,
      fold(input.rawTitle),
      input.mpn ?? "",
      input.gtin ?? "",
      input.brand ?? "",
      fold(input.sourceText ?? "").slice(0, SOURCE_TEXT_MAX),
    ].join("|"),
  );
}

async function sha256(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** La misma clave para la cuarentena, leída de la oferta cruda (que puede no haber pasado el esquema). */
export function rawHashInput(input: unknown, category: Category): HashInput {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const str = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : null);
  return {
    category,
    rawTitle: str("title") ?? "",
    brand: str("brand"),
    mpn: str("mpn"),
    gtin: str("gtin"),
    sourceText: str("sourceText"),
  };
}

/** Barras que algunas tiendas usan para separar partes del título ("RTX 3050 | MSI Ventus 2X | 6GB"). */
const TITLE_SEPARATORS = /\s*[|｜]\s*/g;

/**
 * Tecnomas copia fichas desde su administrador y deja "(clone)" en el nombre, a veces con el código de la ficha
 * original entre corchetes: ese código es el viejo (el bueno viene en el MPN estructurado), así que se va con él.
 */
const TITLE_CLONE = /\s*\(\s*clone\s*\)(\s*\[[^\]]*\])?/gi;

export function cleanTitle(title: string): string {
  return collapseWhitespace(
    decodeEntities(title).replace(TITLE_NOISE, " ").replace(TITLE_CLONE, " ").replace(TITLE_SEPARATORS, " "),
  );
}

function extractExternalId(input: unknown): string | null {
  if (typeof input === "object" && input !== null && "externalId" in input) {
    const id = (input as { externalId: unknown }).externalId;
    return typeof id === "string" || typeof id === "number" ? String(id) : null;
  }
  return null;
}
