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
  "peripherals",
] as const;
export type QuoteSlot = (typeof QUOTE_SLOTS)[number];

/** Lo que vale evitar una tienda (envío y tiempo): elige la opción recomendada de comprar en menos tiendas. */
export const CONDENSE_STORE_VALUE = 10_000;

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
  keyboard: "peripherals",
  mouse: "peripherals",
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
  peripherals: "Periféricos",
};

/** En los slots aditivos todos los ítems cuentan; en los demás, sólo el seleccionado. */
const ADDITIVE_SLOTS: readonly QuoteSlot[] = ["storage", "case_fan", "peripherals"];
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

/** Potencias en las que se venden las fuentes: el cálculo termina en una de ellas, no en un número suelto. */
const PSU_SIZES = [450, 500, 550, 600, 650, 700, 750, 800, 850, 1000, 1200, 1300, 1600] as const;

const nextPsuSize = (watts: number) => PSU_SIZES.find((size) => size >= watts) ?? Math.ceil(watts / 100) * 100;

/**
 * Fuente para un consumo estimado. Mínimo: un 50 % de margen, bastante sobre el 20 a 30 % que suelen dar las
 * calculadoras, por los picos de la tarjeta (decisión del dueño). Recomendada: consumo por 1,8, que deja al equipo
 * cerca del 55 % de la carga de la fuente, donde rinde mejor y más silenciosa, y al menos un escalón sobre el mínimo.
 * Ej.: 463 W da mínima de 700 W y recomendada de 850 W.
 */
export function psuSizing(estimatedWatts: number) {
  const minimum = nextPsuSize(estimatedWatts * 1.5);
  const recommended = nextPsuSize(Math.max(estimatedWatts * 1.8, minimum + 1));
  return { minimum, recommended };
}

/** Tope de `pageSize`: pedir más da 400, no una página más grande. */
export const QUOTES_MAX_PAGE_SIZE = 50;
