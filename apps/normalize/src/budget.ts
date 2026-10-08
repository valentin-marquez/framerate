import type { Db } from "@framerate/database";
import { sql } from "kysely";

// Copia de `apps/match/src/haiku.ts`: los dos Workers reparten el mismo crédito con la misma regla. Cuando un tercero
// la necesite, va a `@framerate/kit`.

/** Inicio y fin del ciclo de facturación que contiene `now`: del día `cycleDay` de un mes al del siguiente (UTC). */
export function billingCycle(now: Date, cycleDay: number) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const startMonth = now.getUTCDate() >= cycleDay ? m : m - 1;
  return { start: new Date(Date.UTC(y, startMonth, cycleDay)), end: new Date(Date.UTC(y, startMonth + 1, cycleDay)) };
}

/**
 * Tope de hoy: lo que quedaba del crédito del ciclo al empezar el día, repartido entre los días que faltan (hoy
 * incluido). Lo que no se gasta un día pasa a los siguientes, y el ciclo nuevo arranca solo.
 */
export function dailyCapUsd(now: Date, cycleDay: number, monthlyUsd: number, spentBeforeToday: number): number {
  const { end } = billingCycle(now, cycleDay);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysLeft = Math.max(1, Math.round((end.getTime() - today) / 86_400_000));
  return Math.max(0, monthlyUsd - spentBeforeToday) / daysLeft;
}

export interface Budget {
  /** Parte del crédito mensual de Anthropic que puede gastar la normalización. */
  monthlyUsd: number;
  /** Día del mes en que se renueva el crédito (el del pago del plan). */
  cycleDay: number;
}

/** Dólares que la normalización todavía puede gastar hoy, según el libro `ai_usage`. */
export async function budgetLeftUsd(db: Db, budget: Budget, now: Date): Promise<number> {
  const cycleStart = billingCycle(now, budget.cycleDay).start.toISOString();
  const startOfDay = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const row = await db.query
    .selectFrom("ai_usage")
    .select([
      sql<number | null>`sum(usd)`.as("cycle"),
      sql<number | null>`sum(case when at >= ${startOfDay} then usd else 0 end)`.as("today"),
    ])
    .where("purpose", "=", "normalize")
    .where("at", ">=", cycleStart)
    .executeTakeFirst();
  const inCycle = Number(row?.cycle ?? 0);
  const today = Number(row?.today ?? 0);
  return dailyCapUsd(now, budget.cycleDay, budget.monthlyUsd, inCycle - today) - today;
}
