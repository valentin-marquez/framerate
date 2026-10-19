import { CONDENSE_MAX_EXTRA } from "@framerate/contracts";

/**
 * Condensar la compra: el menor conjunto de tiendas que cubre todos los ítems, sin costos de envío. Un ítem sólo puede
 * ir a una tienda donde cuesta, por unidad, a lo más `maxExtra` sobre su precio más barato; entre los conjuntos del
 * mismo tamaño gana el que cuesta menos. Dominio puro: la consulta de ofertas vive en el repositorio.
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

/** Corta la búsqueda exacta si una cotización rara la dispara; queda lo mejor encontrado, nunca peor que lo base. */
const NODE_LIMIT = 200_000;

const byPrice = (a: CondenseOffer, b: CondenseOffer) => a.priceCash - b.priceCash || a.listingId - b.listingId;

export function planCondense(items: CondenseItem[], maxExtra = CONDENSE_MAX_EXTRA): Condensed {
  const rows = items.flatMap((item) => {
    // La mejor oferta de cada tienda, de la más barata a la más cara.
    const perStore = new Map<number, CondenseOffer>();
    for (const offer of [...item.offers].sort(byPrice))
      if (!perStore.has(offer.storeId)) perStore.set(offer.storeId, offer);
    const cheapest = [...perStore.values()][0];
    if (!cheapest) return [];
    const allowed = new Map([...perStore].filter(([, offer]) => offer.priceCash - cheapest.priceCash <= maxExtra));
    return [{ itemId: item.itemId, quantity: item.quantity, perStore, cheapest, allowed }];
  });
  type Row = (typeof rows)[number];

  const cheapestStores = new Set(rows.map((r) => r.cheapest.storeId));
  const cheapestCost = rows.reduce((sum, r) => sum + r.cheapest.priceCash * r.quantity, 0);
  const bestIn = (row: Row, stores: Set<number>) =>
    [...row.allowed.values()].filter((o) => stores.has(o.storeId)).sort(byPrice)[0];
  const costOf = (stores: Set<number>) =>
    rows.reduce((sum, r) => sum + (bestIn(r, stores)?.priceCash ?? 0) * r.quantity, 0);

  let best = { stores: cheapestStores, cost: cheapestCost };
  const chosen = new Set<number>();
  let nodes = 0;
  const visit = () => {
    if (++nodes > NODE_LIMIT) return;
    const uncovered = rows.filter((r) => ![...r.allowed.keys()].some((id) => chosen.has(id)));
    if (uncovered.length === 0) {
      const cost = costOf(chosen);
      if (chosen.size < best.stores.size || (chosen.size === best.stores.size && cost < best.cost)) {
        best = { stores: new Set(chosen), cost };
      }
      return;
    }
    if (chosen.size >= best.stores.size) return;
    // Se ramifica sobre el ítem con menos tiendas posibles: es el que más acota la búsqueda.
    const next = uncovered.reduce((a, b) => (b.allowed.size < a.allowed.size ? b : a));
    for (const storeId of next.allowed.keys()) {
      chosen.add(storeId);
      visit();
      chosen.delete(storeId);
    }
  };
  visit();

  const assignments = rows.map((row): CondenseAssignment => {
    const offer = bestIn(row, best.stores) ?? row.cheapest;
    const keptByLimit = [...best.stores].some(
      (storeId) => storeId !== offer.storeId && row.perStore.has(storeId) && !row.allowed.has(storeId),
    );
    return { itemId: row.itemId, offer, cheapest: row.cheapest, keptByLimit };
  });
  const extraCash = assignments.reduce(
    (sum, a, i) => sum + (a.offer.priceCash - a.cheapest.priceCash) * (rows[i]?.quantity ?? 1),
    0,
  );
  return {
    assignments,
    storesBefore: cheapestStores.size,
    storesAfter: new Set(assignments.map((a) => a.offer.storeId)).size,
    extraCash,
  };
}
