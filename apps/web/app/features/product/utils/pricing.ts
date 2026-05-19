import type { ProductPrices } from "~/shared/utils/db-types";

/**
 * Modelo de precios del catálogo chileno.
 *
 * - `cash`   = precio efectivo / transferencia (lo que realmente pagas).
 * - `normal` = precio tarjeta del MISMO listing. NO es un precio anterior:
 *              es ≈ cash * 1.045/1.055 (recargo por medio de pago). Mostrarlo
 *              tachado como "descuento" era un -5% falso y permanente.
 * - `reference` = precio cash más alto que tuvo esa misma oferta en su propio
 *                 historial (ventana 90d). Solo existe si el precio bajó de
 *                 verdad → es la única base para un descuento real.
 */
export interface ProductPricing {
  /** Precio a destacar: el efectivo/transferencia (o normal si no hay cash). */
  current: number | null;
  /** Precio tarjeta/otros medios (más alto que el efectivo). */
  card: number | null;
  /** Hay brecha real efectivo vs tarjeta (medio de pago, no descuento). */
  hasCardGap: boolean;
  /** Hubo una baja real respecto al historial de la propia oferta. */
  hasRealDrop: boolean;
  /** Precio de referencia previo (solo si `hasRealDrop`). */
  reference: number | null;
  /** % de descuento real, redondeado (0 si no hay baja real). */
  dropPct: number;
}

export function getProductPricing(prices: ProductPrices | null | undefined): ProductPricing {
  const cash = prices?.cash || prices?.normal || null;
  const card = prices?.normal ?? null;
  const reference = prices?.reference ?? null;

  const hasCardGap = cash != null && card != null && card > cash;
  const hasRealDrop = cash != null && reference != null && reference > cash;
  const dropPct = hasRealDrop && cash != null && reference != null ? Math.round((1 - cash / reference) * 100) : 0;

  return { current: cash, card, hasCardGap, hasRealDrop, reference, dropPct };
}
