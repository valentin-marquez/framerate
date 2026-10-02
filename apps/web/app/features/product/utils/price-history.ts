import type { Offer, PricePoint } from "@framerate/contracts";

/** Períodos para comparar el precio de hoy. Van en `?periodo=` de la URL; sin él, el último mes. */
export const PERIODS = [
  { key: "1m", days: 30, label: "1 mes", text: "el último mes" },
  { key: "3m", days: 90, label: "3 meses", text: "los últimos 3 meses" },
  { key: "6m", days: 180, label: "6 meses", text: "los últimos 6 meses" },
  { key: "12m", days: 365, label: "12 meses", text: "los últimos 12 meses" },
] as const;

export type Period = (typeof PERIODS)[number];

export const periodFromParam = (value: string | null): Period => PERIODS.find((p) => p.key === value) ?? PERIODS[0];

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** `since` es el primer día con datos; si es el inicio del período, el resumen lo cubre entero. */
export type HistorySummary = { min: number; max: number; usual: number; since: string; coversPeriod: boolean };

/**
 * Mejor precio con transferencia de cada día del período. Ingest guarda un punto sólo cuando cambia el precio o el
 * stock, así que cada tienda arrastra su último precio, y la que no cambió en el período tuvo todo el tiempo el de su
 * oferta actual. null con menos de una semana de datos: con menos, "precio habitual" no significa nada.
 */
export function summarizeHistory(
  points: PricePoint[],
  offers: Offer[],
  days: number,
  now: number,
): HistorySummary | null {
  const periodStart = isoDay(now - days * DAY);
  const changed = new Set(points.map((p) => p.store));
  const last = new Map<string, { priceCash: number; inStock: boolean }>();
  for (const o of offers) if (!changed.has(o.store.slug)) last.set(o.store.slug, o);

  const sorted = points.toSorted((a, b) => a.observedAt.localeCompare(b.observedAt));
  const since = last.size > 0 ? periodStart : sorted[0]?.observedAt.slice(0, 10);
  if (!since) return null;

  const bests: number[] = [];
  let i = 0;
  for (let day = since, t = Date.parse(`${since}T12:00:00Z`); day <= isoDay(now); t += DAY, day = isoDay(t)) {
    for (; i < sorted.length && sorted[i].observedAt.slice(0, 10) <= day; i++) last.set(sorted[i].store, sorted[i]);
    const best = Math.min(...[...last.values()].filter((x) => x.inStock).map((x) => x.priceCash));
    if (Number.isFinite(best)) bests.push(best);
  }
  if (bests.length < 7) return null;

  const prices = bests.toSorted((a, b) => a - b);
  return {
    min: prices[0] ?? 0,
    max: prices.at(-1) ?? 0,
    usual: prices[Math.floor(prices.length / 2)] ?? 0,
    since,
    coversPeriod: since <= periodStart,
  };
}

export type Verdict = { label: string; tone: "good" | "neutral" | "bad" };

export function priceVerdict(today: number, h: HistorySummary): Verdict {
  if (today <= h.min) return { label: "El precio más bajo del período", tone: "good" };
  if (today <= h.usual * 1.02) return { label: "En su precio habitual", tone: "neutral" };
  return { label: "Sobre su precio habitual", tone: "bad" };
}
