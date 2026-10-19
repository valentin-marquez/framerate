import type { Category } from "./category-list";
import type { QuoteItem } from "./quotes";

export const QUOTE_SLOTS = [
  "cpu",
  "motherboard",
  "ram",
  "gpu",
  "psu",
  "case",
  "cpu_cooler",
  "storage",
  "case_fan",
] as const;
export type QuoteSlot = (typeof QUOTE_SLOTS)[number];

/** Condensar la compra no mueve un ítem a una tienda donde cuesta, por unidad, más de esto sobre su precio más barato. */
export const CONDENSE_MAX_EXTRA = 30_000;

/** Slot que ocupa cada categoría; el servidor lo deriva al agregar un producto, el cliente no lo elige. */
export const SLOT_BY_CATEGORY: Record<Category, QuoteSlot> = {
  gpu: "gpu",
  cpu: "cpu",
  motherboard: "motherboard",
  ram: "ram",
  psu: "psu",
  ssd: "storage",
  hdd: "storage",
  cpu_cooler: "cpu_cooler",
  case: "case",
  case_fan: "case_fan",
};

export const QUOTE_SLOT_LABELS: Record<QuoteSlot, string> = {
  cpu: "Procesador",
  motherboard: "Placa madre",
  ram: "Memoria RAM",
  gpu: "Tarjeta de video",
  psu: "Fuente de poder",
  case: "Gabinete",
  cpu_cooler: "Refrigeración CPU",
  storage: "Almacenamiento",
  case_fan: "Ventilación",
};

/** En los slots aditivos todos los ítems cuentan; en los demás, sólo el seleccionado. */
const ADDITIVE_SLOTS: readonly QuoteSlot[] = ["storage", "case_fan"];
export const isAdditiveSlot = (slot: QuoteSlot) => ADDITIVE_SLOTS.includes(slot);

/** private: sólo el dueño. unlisted: quien tenga el link. public: además aparece en su perfil. */
export const QUOTE_VISIBILITIES = ["private", "unlisted", "public"] as const;
export type QuoteVisibility = (typeof QUOTE_VISIBILITIES)[number];

/** Suma de los ítems seleccionados con oferta, por su cantidad: la usan el servidor y la web al actualizar sin esperar. */
export function quoteTotals(items: readonly QuoteItem[]) {
  let cash = 0;
  let card = 0;
  for (const item of items) {
    if (!item.isSelected || !item.offer) continue;
    cash += item.offer.priceCash * item.quantity;
    card += item.offer.priceCard * item.quantity;
  }
  return { cash, card };
}

/** Tope de `pageSize`: pedir más da 400, no una página más grande. */
export const QUOTES_MAX_PAGE_SIZE = 50;
