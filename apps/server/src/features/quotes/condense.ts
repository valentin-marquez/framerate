import { CONDENSE_STORE_VALUE } from "@framerate/contracts";

/**
 * Comprar en menos tiendas, sin costos de envío: para cada k, el plan de menor total en efectivo con a lo más k
 * tiendas, desde 1 hasta el k con el que ya se paga lo mismo que comprando cada ítem en su tienda más barata. Fuerza
 * bruta sobre subconjuntos de tiendas: en cada uno, cada ítem va a su oferta más barata dentro del subconjunto.
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

export interface CondensePick {
  itemId: number;
  quantity: number;
  offer: CondenseOffer;
  cheapest: CondenseOffer;
}

export interface CondensePlan {
  /** Tiendas que usa el plan (o el k pedido, si no está disponible). */
  stores: number;
  available: boolean;
  unavailableReason?: string;
  totalCash: number;
  /** Lo que cuesta de más frente a la tienda más barata de cada ítem, por las cantidades. */
  extraCash: number;
  /** La de menor `extraCash + CONDENSE_STORE_VALUE × tiendas`; a igual puntaje, la de menos tiendas. */
  recommended: boolean;
  picks: CondensePick[];
}

export interface CondenseResult {
  /** Ítems con al menos una oferta: los que entran en los planes. */
  itemCount: number;
  minTotalCash: number;
  options: CondensePlan[];
}

// ponytail: 2^12 = 4.096 subconjuntos como máximo. Con más tiendas quedan las que tienen el precio más bajo de algún
// ítem y luego las que cubren más ítems; si las más baratas pasaran de 12, la última opción no llega al mínimo.
// Subir el tope o pasar a branch and bound por k si alguna cotización real lo pide.
export const CONDENSE_MAX_STORES = 12;

const byPrice = (a: CondenseOffer, b: CondenseOffer) => a.priceCash - b.priceCash || a.listingId - b.listingId;

export function planCondenseOptions(items: CondenseItem[]): CondenseResult {
  const rows = items.flatMap((item) => {
    // La mejor oferta de cada tienda; la primera es la más barata del ítem.
    const perStore = new Map<number, CondenseOffer>();
    for (const offer of [...item.offers].sort(byPrice))
      if (!perStore.has(offer.storeId)) perStore.set(offer.storeId, offer);
    const cheapest = [...perStore.values()][0];
    return cheapest ? [{ itemId: item.itemId, quantity: item.quantity, cheapest, perStore }] : [];
  });
  const minTotalCash = rows.reduce((sum, r) => sum + r.cheapest.priceCash * r.quantity, 0);
  if (rows.length === 0) return { itemCount: 0, minTotalCash: 0, options: [] };

  const coverage = new Map<number, number>();
  for (const r of rows)
    for (const storeId of r.perStore.keys()) coverage.set(storeId, (coverage.get(storeId) ?? 0) + 1);
  const cheapestStores = new Set(rows.map((r) => r.cheapest.storeId));
  const candidates = [...coverage.keys()]
    .sort(
      (a, b) =>
        Number(cheapestStores.has(b)) - Number(cheapestStores.has(a)) ||
        (coverage.get(b) ?? 0) - (coverage.get(a) ?? 0) ||
        a - b,
    )
    .slice(0, CONDENSE_MAX_STORES);

  /** El mejor plan de un subconjunto, o null si algún ítem no tiene oferta en él. */
  const planOf = (subset: number[]) => {
    const used = new Set<number>();
    const picks: CondensePick[] = [];
    let total = 0;
    for (const r of rows) {
      let offer: CondenseOffer | undefined;
      for (const storeId of subset) {
        const o = r.perStore.get(storeId);
        if (!o) continue;
        // A igual precio, una tienda que ya está en el plan; luego el menor listingId.
        const better =
          !offer ||
          o.priceCash < offer.priceCash ||
          (o.priceCash === offer.priceCash &&
            (Number(used.has(o.storeId)) - Number(used.has(offer.storeId)) || offer.listingId - o.listingId) > 0);
        if (better) offer = o;
      }
      if (!offer) return null;
      used.add(offer.storeId);
      total += offer.priceCash * r.quantity;
      picks.push({ itemId: r.itemId, quantity: r.quantity, offer, cheapest: r.cheapest });
    }
    return { total, stores: used.size, picks };
  };

  const bestOf = (k: number) => {
    let best: ReturnType<typeof planOf> = null;
    const subset: number[] = [];
    const visit = (from: number) => {
      if (subset.length === k) {
        const plan = planOf(subset);
        if (plan && (!best || plan.total < best.total || (plan.total === best.total && plan.stores < best.stores)))
          best = plan;
        return;
      }
      for (let i = from; i <= candidates.length - (k - subset.length); i++) {
        subset.push(candidates[i] as number);
        visit(i + 1);
        subset.pop();
      }
    };
    visit(0);
    return best as ReturnType<typeof planOf>;
  };

  const options: CondensePlan[] = [];
  for (let k = 1; k <= candidates.length; k++) {
    const plan = bestOf(k);
    if (!plan) {
      options.push({
        stores: k,
        available: false,
        unavailableReason:
          k === 1
            ? `Ninguna tienda tiene los ${rows.length} componentes`
            : `Ninguna combinación de ${k} tiendas tiene los ${rows.length} componentes`,
        totalCash: 0,
        extraCash: 0,
        recommended: false,
        picks: [],
      });
      continue;
    }
    // Si el mejor de k usa menos tiendas, es la misma opción que una anterior.
    if (plan.stores === k)
      options.push({
        stores: k,
        available: true,
        totalCash: plan.total,
        extraCash: plan.total - minTotalCash,
        recommended: false,
        picks: plan.picks,
      });
    if (plan.total === minTotalCash) break;
  }

  const score = (o: CondensePlan) => o.extraCash + CONDENSE_STORE_VALUE * o.stores;
  const recommended = options
    .filter((o) => o.available)
    .reduce<CondensePlan | null>((best, o) => (!best || score(o) < score(best) ? o : best), null);
  if (recommended) recommended.recommended = true;
  return { itemCount: rows.length, minTotalCash, options };
}
