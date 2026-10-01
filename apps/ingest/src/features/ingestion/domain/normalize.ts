import { type Category, CategorySchema } from "@framerate/contracts";
import { collapseWhitespace, decodeEntities, fold } from "@framerate/kit";
import type { Attributes } from "@framerate/matching";
import { buildFingerprint, type Fingerprint } from "@framerate/matching";
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

/**
 * Atributos sin los cuales la oferta no es confiable. Si el extractor no los
 * encuentra, casi siempre es un accesorio mal categorizado (soporte de GPU,
 * cable riser) o un título que el extractor aún no entiende: ambos casos se
 * revisan en cuarentena en lugar de ensuciar el catálogo.
 */
const REQUIRED_ATTRIBUTES: Record<Category, readonly string[]> = {
  gpu: ["chipset"],
  cpu: ["model"],
  motherboard: ["chipset"],
  ram: ["type", "capacity"],
  psu: ["wattage"],
  ssd: ["capacity"],
  hdd: ["capacity"],
  cpu_cooler: [],
  case: [],
  case_fan: [],
};

const NOT_NEW =
  /\b(usad[oa]s?|reacondicionad[oa]s?|refurbished|open ?box|caja abierta|caja (mala|danada)|seminuev[oa]s?|segunda mano|outlet)\b/;
const BUNDLE = /\b(combo|bundle|kit (pc|gamer)|pc armad[oa])\b/;
// "Pack de…" o "KIT placa + memoria" juntan productos distintos ("80+ Bronze" y "Xeon 4416+" no llevan " + "), salvo
// en ventiladores: un pack de tres o un kit con controladora es un producto de la categoría.
const MULTI = /\bpack de\b|\bkit\b.*\s\+\s/;
const OTHER_PRODUCT = /\b(notebook|laptop|all in one|monitor|consola|tablet)\b/;
// En RAM y SSD "notebook"/"laptop" suele ser compatibilidad (SO-DIMM, "para PC y Laptop"): sólo cuenta al inicio.
const OTHER_PRODUCT_START = /^(notebook|laptop|all in one|monitor|consola|tablet)\b/;
const FAN_TITLE = /^(ventilador|pack|kit)\b/;
const CPU_COOLER_CUE = /\b(cpu|torre|tower|disipador|heatpipes?|liquid[ao]|aio|water|lga ?\d{4}|am[45])\b/;
const EXTERNAL_DRIVE = /\b(extern[oa]s?|portatil|portable|usb)\b/;

/** Lo que las tiendas meten en la categoría equivocada, con el motivo de lo que realmente es. */
const MISPLACED: Partial<Record<Category, Array<[misplaced: (title: string) => boolean, reason: string]>>> = {
  // Los coolers de CPU dicen CPU, torre, líquida…; un "Ventilador …" sin eso es de gabinete.
  cpu_cooler: [
    [(t) => FAN_TITLE.test(t) && !CPU_COOLER_CUE.test(t), "category:case_fan"],
    [(t) => /^pasta termica/.test(t), "category:other_product"],
  ],
  case_fan: [[(t) => /\b(cpu|aio|disipador|heatpipes?)\b|^refrigeracion liquida/.test(t), "category:cpu_cooler"]],
  ssd: [
    [(t) => EXTERNAL_DRIVE.test(t), "category:external_drive"],
    [(t) => /\bddr[345]\b|\b(pendrive|micro ?sd|sdxc|sdhc|tarjeta de memoria)\b/.test(t), "category:other_product"],
  ],
  hdd: [[(t) => EXTERNAL_DRIVE.test(t), "category:external_drive"]],
};

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
  const misplaced = MISPLACED[raw.category]?.find(([test]) => test(folded));
  if (misplaced) return { ok: false, externalId, reason: misplaced[1] };

  // Algunas tiendas invierten los campos: el efectivo siempre es el menor.
  const priceCash = Math.min(raw.priceCash, raw.priceCard ?? raw.priceCash);
  const priceCard = Math.max(raw.priceCash, raw.priceCard ?? raw.priceCash);
  const [min, max] = PRICE_RANGE[raw.category];
  if (priceCash < min || priceCard > max) return { ok: false, externalId, reason: "price:out_of_range" };

  const fingerprint = buildFingerprint({
    category: raw.category,
    title,
    brand: raw.brand,
    mpn: raw.mpn,
    gtin: raw.gtin,
  });
  for (const field of REQUIRED_ATTRIBUTES[raw.category]) {
    if (fingerprint.attributes[field] === undefined) {
      return { ok: false, externalId, reason: `attribute:missing:${field}` };
    }
  }

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
    },
  };
}

/** Barras que algunas tiendas usan para separar partes del título ("RTX 3050 | MSI Ventus 2X | 6GB"). */
const TITLE_SEPARATORS = /\s*[|｜]\s*/g;

export function cleanTitle(title: string): string {
  return collapseWhitespace(decodeEntities(title).replace(TITLE_NOISE, " ").replace(TITLE_SEPARATORS, " "));
}

function extractExternalId(input: unknown): string | null {
  if (typeof input === "object" && input !== null && "externalId" in input) {
    const id = (input as { externalId: unknown }).externalId;
    return typeof id === "string" || typeof id === "number" ? String(id) : null;
  }
  return null;
}
