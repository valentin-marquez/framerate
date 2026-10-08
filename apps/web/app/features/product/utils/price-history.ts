import { bestOf, historyDays, type Offer, type PricePoint } from "@framerate/contracts";

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

export { bestOf, type HistoryDay, historyDays, type PriceKind, type StoreDay } from "@framerate/contracts";

/**
 * Más bajo, habitual (mediana) y más alto del mejor precio con transferencia de cada día. null con menos de una semana
 * de datos: con menos, "precio habitual" no significa nada.
 */
export function summarizeHistory(
  points: PricePoint[],
  offers: Offer[],
  days: number,
  now: number,
): HistorySummary | null {
  const ds = historyDays(points, offers, days, now);
  const bests = ds.flatMap((d) => bestOf(d, "cash")?.cash ?? []);
  if (bests.length < 7) return null;

  const prices = bests.toSorted((a, b) => a - b);
  const since = ds[0]?.day ?? "";
  return {
    min: prices[0] ?? 0,
    max: prices.at(-1) ?? 0,
    usual: prices[Math.floor(prices.length / 2)] ?? 0,
    since,
    coversPeriod: since <= isoDay(now - days * DAY),
  };
}

/** Marcas redondas del eje (1, 2, 2,5 o 5 por potencia de diez) que cubren [min, max] con unas `count` divisiones. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const raw = (max - min) / count || Math.abs(max) / 10 || 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const m = [1, 2, 2.5, 5, 10].reduce((a, b) => (Math.abs(b * pow - raw) < Math.abs(a * pow - raw) ? b : a));
  const step = m * pow;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(v);
  while (ticks.length < 2 || (ticks.at(-1) ?? 0) < max) ticks.push((ticks.at(-1) ?? 0) + step);
  return ticks;
}

export type Verdict = { label: string; tone: "good" | "neutral" | "bad" };

export function priceVerdict(today: number, h: HistorySummary): Verdict {
  if (today <= h.min) return { label: "El precio más bajo del período", tone: "good" };
  if (today <= h.usual * 1.02) return { label: "En su precio habitual", tone: "neutral" };
  return { label: "Sobre su precio habitual", tone: "bad" };
}
