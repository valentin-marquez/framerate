import type { Db } from "@framerate/database";
import { sql } from "kysely";
import type { Judgement, Side } from "./judge";

/** Lo que `framerate-match` guarda en `match_reviews.evidence.ai` (sin migración). */
export interface AiEvidence extends Judgement {
  mode: "shadow" | "reject" | "live";
  at: string;
  /** Vetos de `compare()` que impidieron aceptar en modo live. */
  vetoes?: string[];
}

/**
 * Revisiones pendientes que todavía no tienen veredicto de este modelo en este modo. Pasar de shadow a reject o live las
 * vuelve a incluir: el consumidor reusa la probabilidad guardada y sólo aplica la decisión.
 */
export async function reviewsToVerify(db: Db, model: string, mode: string, limit: number): Promise<number[]> {
  const rows = await db.query
    .selectFrom("match_reviews")
    .select("id")
    .where("status", "=", "pending")
    .where(
      sql<boolean>`(json_extract(evidence, '$.ai.model') IS NOT ${model} OR json_extract(evidence, '$.ai.mode') IS NOT ${mode})`,
    )
    .orderBy("id")
    .limit(limit)
    .execute();
  return rows.map((r) => r.id);
}

/** Neurons gastados desde `since` (ISO), sumando los veredictos guardados. */
export async function neuronsSpentSince(db: Db, since: string): Promise<number> {
  const row = await db.query
    .selectFrom("match_reviews")
    .select(sql<number | null>`sum(json_extract(evidence, '$.ai.neurons'))`.as("n"))
    .where(sql<boolean>`json_extract(evidence, '$.ai.at') >= ${since}`)
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

/**
 * Los dos lados del par. El candidato es un producto: se lo representa con su oferta activa más antigua (la que
 * suele haberlo creado), con el nombre del producto si ya no tiene ofertas activas.
 */
export async function loadPair(db: Db, reviewId: number) {
  const review = await db.query
    .selectFrom("match_reviews as r")
    .innerJoin("listings as l", "l.id", "r.listing_id")
    .innerJoin("products as p", "p.id", "r.candidate_product_id")
    .select([
      "r.id",
      "r.status",
      "r.evidence",
      "r.candidate_product_id as candidateId",
      "l.title",
      "l.brand",
      "l.mpn",
      "p.name as productName",
      "p.brand as productBrand",
    ])
    .where("r.id", "=", reviewId)
    .executeTakeFirst();
  if (!review) return null;

  const founder = await db.query
    .selectFrom("listings")
    .select(["title", "brand", "mpn"])
    .where("product_id", "=", review.candidateId)
    .where("is_active", "=", 1)
    .orderBy("id")
    .limit(1)
    .executeTakeFirst();

  const listing: Side = { title: review.title, brand: review.brand, mpn: review.mpn };
  const candidate: Side = founder ?? { title: review.productName, brand: review.productBrand, mpn: null };
  const evidence = JSON.parse(review.evidence) as { ai?: AiEvidence };
  return { id: review.id, status: review.status, listing, candidate, ai: evidence.ai ?? null };
}

export async function saveAiEvidence(db: Db, reviewId: number, ai: AiEvidence) {
  await db.query
    .updateTable("match_reviews")
    .set({ evidence: sql`json_set(evidence, '$.ai', json(${JSON.stringify(ai)}))` })
    .where("id", "=", reviewId)
    .execute();
}
