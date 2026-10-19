import { CONDENSE_MAX_EXTRA, CONDENSE_STORE_VALUE } from "@framerate/contracts";

/**
 * Condensar la compra, sin costos de envío: asigna cada ítem a una tienda de modo que minimice
 * `plata de más + storeValue × tiendas distintas`, donde `storeValue` es lo que vale evitar una tienda (envío y
 * tiempo). Así condensa sólo si cada tienda de menos cuesta hasta `storeValue` de más; en un empate gana el de menos
 * tiendas. Un ítem sólo puede ir a una tienda donde cuesta, por unidad, a lo más `maxExtra` sobre su precio más barato.
 * Dominio puro: la consulta de ofertas vive en el repositorio.
 */

export interface CondenseOffer {
  listingId: number;
  storeId: number;
  priceCash: number;
}

export interface CondenseItem {
  itemId: number;
  quantity: number;
  /** Ofertas activas y con stock del producto; una tienda puede aparecer más de una vez. */
  offers: CondenseOffer[];
}

export interface CondenseAssignment {
  itemId: number;
  offer: CondenseOffer;
  cheapest: CondenseOffer;
  /** Otra tienda del plan lo tiene, pero pasado el tope: se queda donde está. */
  keptByLimit: boolean;
}

export interface Condensed {
  assignments: CondenseAssignment[];
  /** Tiendas comprando cada ítem en la más barata, y con el plan. */
  storesBefore: number;
  storesAfter: number;
  /** Lo que cuesta de más el plan, por las cantidades. */
  extraCash: number;
}

export interface CondenseOptions {
  /** Tope por unidad sobre el precio más barato para mover un ítem a otra tienda. */
  maxExtra?: number;
  /** Cuánto de más vale evitar una tienda. */
  storeValue?: number;
}

/** Corta la búsqueda exacta si una cotización rara la dispara; queda lo mejor encontrado, nunca peor que lo base. */
const NODE_LIMIT = 200_000;

const byPrice = (a: CondenseOffer, b: CondenseOffer) => a.priceCash - b.priceCash || a.listingId - b.listingId;

export function planCondense(
  items: CondenseItem[],
  { maxExtra = CONDENSE_MAX_EXTRA, storeValue = CONDENSE_STORE_VALUE }: CondenseOptions = {},
): Condensed {
  const rows = items.flatMap((item) => {
    // La mejor oferta de cada tienda, de la más barata a la más cara.
    const perStore = new Map<number, CondenseOffer>();
    for (const offer of [...item.offers].sort(byPrice))
      if (!perStore.has(offer.storeId)) perStore.set(offer.storeId, offer);
    const cheapest = [...perStore.values()][0];
    if (!cheapest) return [];
    const allowed = [...perStore.values()].filter((offer) => offer.priceCash - cheapest.priceCash <= maxExtra);
    return [{ itemId: item.itemId, quantity: item.quantity, perStore, cheapest, allowed }];
  });

  // Los ítems con menos tiendas posibles primero: acotan más la búsqueda.
  const order = [...rows].sort((a, b) => a.allowed.length - b.allowed.length);
  const cheapestStores = new Set(rows.map((r) => r.cheapest.storeId));
  let best = {
    score: storeValue * cheapestStores.size,
    stores: cheapestStores.size,
    picks: order.map((r) => r.cheapest),
  };

  const used = new Map<number, number>();
  const picks: CondenseOffer[] = [];
  let nodes = 0;
  const visit = (i: number, extra: number) => {
    if (++nodes > NODE_LIMIT) return;
    // La plata de más sólo sube: si ya no se puede mejorar el puntaje, no se sigue.
    const score = extra + storeValue * used.size;
    if (score > best.score) return;
    const row = order[i];
    if (!row) {
      if (score < best.score || used.size < best.stores) best = { score, stores: used.size, picks: [...picks] };
      return;
    }
    for (const offer of row.allowed) {
      used.set(offer.storeId, (used.get(offer.storeId) ?? 0) + 1);
      picks[i] = offer;
      visit(i + 1, extra + (offer.priceCash - row.cheapest.priceCash) * row.quantity);
      const left = (used.get(offer.storeId) ?? 1) - 1;
      if (left === 0) used.delete(offer.storeId);
      else used.set(offer.storeId, left);
    }
  };
  visit(0, 0);

  const planStores = new Set(best.picks.map((o) => o.storeId));
  const assignments = order.map((row, i): CondenseAssignment => {
    const offer = best.picks[i] ?? row.cheapest;
    const keptByLimit = [...planStores].some(
      (storeId) =>
        storeId !== offer.storeId &&
        row.perStore.has(storeId) &&
        !row.allowed.some((allowedOffer) => allowedOffer.storeId === storeId),
    );
    return { itemId: row.itemId, offer, cheapest: row.cheapest, keptByLimit };
  });
  const quantities = new Map(rows.map((r) => [r.itemId, r.quantity]));
  const extraCash = assignments.reduce(
    (sum, a) => sum + (a.offer.priceCash - a.cheapest.priceCash) * (quantities.get(a.itemId) ?? 1),
    0,
  );
  return {
    assignments,
    storesBefore: cheapestStores.size,
    storesAfter: planStores.size,
    extraCash,
  };
}
