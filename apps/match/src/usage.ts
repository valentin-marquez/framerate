import type { AiUsageTable, Db } from "@framerate/database";
import type { Insertable } from "kysely";

/**
 * Libro de gasto `ai_usage` (spec 2026-10-08 §7): una fila por llamada a un modelo, también cuando falla, así el
 * tope del juez y las incidencias se leen de un solo lugar en vez de `match_reviews.evidence`.
 */
export type UsageStatus = AiUsageTable["status"];

export async function recordUsage(db: Db, row: Omit<Insertable<AiUsageTable>, "worker">) {
  await db.query
    .insertInto("ai_usage")
    .values({ worker: "match", ...row })
    .execute();
}

/** Dólares gastados por este Worker desde `since` (ISO). */
export async function usdSpentSince(db: Db, since: string): Promise<number> {
  const row = await db.query
    .selectFrom("ai_usage")
    .select((eb) => eb.fn.sum<number | null>("usd").as("usd"))
    .where("worker", "=", "match")
    .where("at", ">=", since)
    .executeTakeFirst();
  return Number(row?.usd ?? 0);
}

/** Estado de `ai_usage` para un error de la API de Anthropic. */
export function usageStatusOf(error: unknown): UsageStatus {
  const status = (error as { status?: unknown })?.status;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 429) return "rate_limited";
  if (status === 402 || /credit|billing/i.test(message)) return "no_credit";
  return "error";
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
