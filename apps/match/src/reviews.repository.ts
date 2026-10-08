import { type Db, parseJson } from "@framerate/database";
import { sql } from "kysely";
import type { HaikuOpinion } from "./haiku";
import type { Judgement, Side, SideIdentity } from "./judge";

/** Lo que `framerate-match` guarda en `match_reviews.evidence.ai` (sin migración). */
export interface AiEvidence extends Judgement {
  mode: "shadow" | "reject" | "live";
  at: string;
  /** Vetos de `compare()` que impidieron aceptar en modo live. */
  vetoes?: string[];
  /** Motivo por el que `acceptGuard` frenó una aceptación del modelo. */
  guard?: string;
  /** Segunda opinión de Haiku cuando Gemma no decidió (#149). En sombra no cambia `verdict`. */
  haiku?: HaikuOpinion & { mode: "shadow" | "live"; at: string };
}

/**
 * Revisiones pendientes que todavía no tienen veredicto de este modelo en este modo. Pasar de shadow a reject o live las
 * vuelve a incluir: el consumidor reusa la probabilidad guardada y sólo aplica la decisión.
 *
 * Con Haiku encendido también entran las que Gemma dejó pendientes sin su opinión en el modo actual (#149): si no, sólo
 * alcanzaría a las revisiones nuevas y las que ya estaban en la cola se quedarían ahí para siempre.
 */
export async function reviewsToVerify(
  db: Db,
  model: string,
  mode: string,
  limit: number,
  haiku: { model: string; mode: string } | null = null,
): Promise<number[]> {
  const rows = await db.query
    .selectFrom("match_reviews")
    .select("id")
    .where("status", "=", "pending")
    .where(
      sql<boolean>`(
        json_extract(evidence, '$.ai.model') IS NOT ${model}
        OR json_extract(evidence, '$.ai.mode') IS NOT ${mode}
        OR (
          ${haiku ? 1 : 0} = 1
          AND json_extract(evidence, '$.ai.verdict') = 'pending'
          AND (
            json_extract(evidence, '$.ai.haiku.model') IS NOT ${haiku?.model ?? null}
            OR json_extract(evidence, '$.ai.haiku.mode') IS NOT ${haiku?.mode ?? null}
          )
        )
      )`,
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
 * suele haberlo creado), con el nombre del producto si ya no tiene ofertas activas. Cada lado lleva su identidad
 * anclada (la versión más nueva) si el normalizador ya pasó por esa oferta.
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
      "l.id as listingId",
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
    .select(["id", "title", "brand", "mpn"])
    .where("product_id", "=", review.candidateId)
    .where("is_active", "=", 1)
    .orderBy("id")
    .limit(1)
    .executeTakeFirst();
  const identities = await db.query
    .selectFrom("listing_identity")
    .select(["listing_id", "category", "name", "identity"])
    .where("listing_id", "in", [review.listingId, founder?.id ?? review.listingId])
    .orderBy("version", "desc")
    .execute();
  const identityOf = (listingId: number | undefined): SideIdentity | undefined => {
    const row = identities.find((i) => i.listing_id === listingId);
    return row && { category: row.category, name: row.name, identity: parseJson(row.identity, {}) };
  };

  const listing: Side = {
    title: review.title,
    brand: review.brand,
    mpn: review.mpn,
    identity: identityOf(review.listingId),
  };
  const candidate: Side = founder
    ? { title: founder.title, brand: founder.brand, mpn: founder.mpn, identity: identityOf(founder.id) }
    : { title: review.productName, brand: review.productBrand, mpn: null };
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
