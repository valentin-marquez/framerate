import type { Category, PipelineShadowReport } from "@framerate/contracts";
import { type Db, parseJson } from "@framerate/database";
import { sql } from "kysely";

const SAMPLE_SIZE = 30;

/** Reporte del vínculo en sombra de una categoría: última versión por oferta, los movimientos primero en la muestra. */
export async function shadowReport(db: Db, category: Category): Promise<PipelineShadowReport> {
  const latest = db.query
    .selectFrom("match_shadow as s")
    .innerJoin("listings as l", "l.id", "s.listing_id")
    .where("l.category", "=", category)
    .where(sql<boolean>`s.version = (SELECT max(version) FROM match_shadow s2 WHERE s2.listing_id = s.listing_id)`);
  const disagree = (kind: string) => sql<number>`sum(CASE WHEN s.agrees = 0 AND s.kind = ${kind} THEN 1 ELSE 0 END)`;

  const [[counts], sample] = await db.read([
    latest.select([
      sql<number | null>`max(s.version)`.as("version"),
      sql<number>`count(*)`.as("total"),
      sql<number>`sum(s.agrees)`.as("agrees"),
      disagree("link").as("moves"),
      disagree("new_product").as("new_products"),
      disagree("review").as("reviews"),
    ]),
    latest
      .innerJoin("stores as st", "st.id", "l.store_id")
      .leftJoin("products as cur", "cur.id", "s.current_product_id")
      .leftJoin("products as p", "p.id", "s.product_id")
      .select([
        "s.listing_id",
        "l.title",
        "st.slug as store",
        "s.kind",
        "s.score",
        "s.vetoes",
        "s.created_at",
        "cur.id as cur_id",
        "cur.slug as cur_slug",
        "cur.name as cur_name",
        "p.id as p_id",
        "p.slug as p_slug",
        "p.name as p_name",
      ])
      .where("s.agrees", "=", 0)
      .orderBy(sql`s.kind = 'link'`, "desc")
      .orderBy("s.id", "desc")
      .limit(SAMPLE_SIZE),
  ]);

  return {
    category,
    version: counts?.version == null ? null : Number(counts.version),
    total: Number(counts?.total ?? 0),
    agrees: Number(counts?.agrees ?? 0),
    moves: Number(counts?.moves ?? 0),
    newProducts: Number(counts?.new_products ?? 0),
    reviews: Number(counts?.reviews ?? 0),
    sample: sample.map((r) => ({
      listingId: r.listing_id,
      title: r.title,
      store: r.store,
      kind: r.kind,
      score: r.score,
      vetoes: parseJson<unknown>(r.vetoes, null),
      current: r.cur_id == null ? null : { id: r.cur_id, slug: r.cur_slug as string, name: r.cur_name as string },
      proposed: r.p_id == null ? null : { id: r.p_id, slug: r.p_slug as string, name: r.p_name as string },
      createdAt: r.created_at,
    })),
  };
}
