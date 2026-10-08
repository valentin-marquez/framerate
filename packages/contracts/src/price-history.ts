import type { Offer, PricePoint } from "./catalog";

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export type PriceKind = "cash" | "card";
export type StoreDay = { store: string; storeName: string; cash: number; card: number; inStock: boolean };
export type HistoryDay = { day: string; stores: StoreDay[] };

/**
 * Estado de cada tienda día a día del período. Ingest guarda un punto sólo cuando cambia el precio o el stock, así que
 * cada tienda arrastra su último precio, y la que no cambió en el período tuvo todo el tiempo el de su oferta actual.
 * Parte el primer día con datos (o el inicio del período, si alguna tienda no cambió) y termina hoy.
 */
export function historyDays(points: PricePoint[], offers: Offer[], days: number, now: number): HistoryDay[] {
  const periodStart = isoDay(now - days * DAY);
  const changed = new Set(points.map((p) => p.store));
  const last = new Map<string, StoreDay>();
  for (const o of offers) {
    if (changed.has(o.store.slug)) continue;
    last.set(o.store.slug, {
      store: o.store.slug,
      storeName: o.store.name,
      cash: o.priceCash,
      card: o.priceCard,
      inStock: o.inStock,
    });
  }

  const sorted = points.toSorted((a, b) => a.observedAt.localeCompare(b.observedAt));
  const since = last.size > 0 ? periodStart : sorted[0]?.observedAt.slice(0, 10);
  if (!since) return [];

  const out: HistoryDay[] = [];
  let i = 0;
  for (let day = since, t = Date.parse(`${since}T12:00:00Z`); day <= isoDay(now); t += DAY, day = isoDay(t)) {
    for (let p = sorted[i]; p && p.observedAt.slice(0, 10) <= day; p = sorted[++i]) {
      last.set(p.store, {
        store: p.store,
        storeName: p.storeName,
        cash: p.priceCash,
        card: p.priceCard,
        inStock: p.inStock,
      });
    }
    out.push({ day, stores: [...last.values()] });
  }
  return out;
}

/** La tienda con stock más barata del día en ese precio; undefined si ninguna tenía stock. */
export function bestOf(d: HistoryDay, kind: PriceKind): StoreDay | undefined {
  let best: StoreDay | undefined;
  for (const s of d.stores) if (s.inStock && (!best || s[kind] < best[kind])) best = s;
  return best;
}
