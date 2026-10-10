import type { Db } from "@framerate/database";
import { compare, createReview, listingFingerprint, loadCandidates, overrideKind } from "@framerate/matching";
import { sql } from "kysely";

/**
 * Propone revisiones para los productos duplicados que YA existen (#148).
 *
 * Una revisión nace sólo cuando una oferta nueva se compara contra un producto candidato, así que dos productos
 * creados por separado no se vuelven a comparar nunca: el duplicado queda publicado para siempre. Acá se buscan los
 * pares que comparten clave de atributos y se abre una revisión por cada oferta del producto con menos ofertas,
 * contra el que tiene más. Eso los mete en la cola que el Gatekeeper ya sabe resolver: el modelo decide los claros,
 * la guarda determinista frena lo dudoso y la persona arbitra el resto.
 *
 * Nunca vincula ni fusiona por su cuenta, ni siquiera con puntaje alto: medido con datos de producción, un par como
 * "ASUS Dual RTX 5060 OC" contra "ASUS Dual RTX 5060 Advanced Edition OC" puntúa 0,95 y son tarjetas distintas.
 */
export interface DetectResult {
  /** Pares (oferta, producto candidato) evaluados. */
  evaluated: number;
  proposed: number;
  skipped: Record<string, number>;
  samples: Array<{ listingId: number; candidateProductId: number; score: number; title: string; candidate: string }>;
}

interface GroupRow {
  key: string;
  id: number;
  offers: number;
  category: string;
  name: string;
  /** Hash de la foto original. Dos productos con el mismo hash tienen la misma foto byte a byte. */
  image: string | null;
}

/** Grupos de productos con oferta activa que comparten clave de atributos: podrían ser el mismo. */
async function duplicateGroups(db: Db, limit: number): Promise<GroupRow[][]> {
  const rows = await db.query
    .selectFrom("products as p")
    .select([
      "p.attribute_key as key",
      "p.id",
      "p.offer_count as offers",
      "p.category",
      "p.name",
      "p.image_key as image",
    ])
    .where("p.attribute_key", "is not", null)
    .where(sql<boolean>`exists (select 1 from listings l where l.product_id = p.id and l.is_active = 1)`)
    .where(
      sql<boolean>`p.attribute_key in (
        select attribute_key from products where attribute_key is not null group by attribute_key having count(*) > 1
      )`,
    )
    .orderBy("p.attribute_key")
    .orderBy("p.offer_count", "desc")
    .orderBy("p.id")
    .execute();
  const groups = new Map<string, GroupRow[]>();
  for (const row of rows as GroupRow[]) {
    const group = groups.get(row.key) ?? [];
    group.push(row);
    groups.set(row.key, group);
  }
  return [...groups.values()].filter((g) => g.length > 1).slice(0, limit);
}

/** ¿El par ya fue descartado por una persona, por el modelo o por una revisión rechazada? */
async function alreadyDecided(db: Db, listingId: number, candidateProductId: number): Promise<string | null> {
  if ((await overrideKind(db, listingId, candidateProductId)) !== null) return "override";
  const review = await db.query
    .selectFrom("match_reviews")
    .select("status")
    .where("listing_id", "=", listingId)
    .where("candidate_product_id", "=", candidateProductId)
    .executeTakeFirst();
  if (review) return review.status === "pending" ? "ya_pendiente" : `ya_${review.status}`;
  const pending = await db.query
    .selectFrom("match_reviews")
    .select("id")
    .where("listing_id", "=", listingId)
    .where("status", "=", "pending")
    .executeTakeFirst();
  return pending ? "oferta_con_revision" : null;
}

export async function proposeDuplicateReviews(
  db: Db,
  input: { now: Date; maxGroups?: number; maxProposals?: number; dryRun?: boolean },
): Promise<DetectResult> {
  const now = input.now.toISOString();
  const result: DetectResult = { evaluated: 0, proposed: 0, skipped: {}, samples: [] };
  const count = (reason: string) => {
    result.skipped[reason] = (result.skipped[reason] ?? 0) + 1;
  };

  for (const group of await duplicateGroups(db, input.maxGroups ?? 500)) {
    const [keeper, ...rest] = group;
    if (!keeper) continue;
    const [candidate] = await loadCandidates(db, [keeper.id], { mpn: null, gtin: null });
    if (!candidate) continue;

    for (const other of rest) {
      const listings = await db.query
        .selectFrom("listings")
        .select(["id", "title", "brand", "mpn", "gtin", "category"])
        .where("product_id", "=", other.id)
        .where("is_active", "=", 1)
        .orderBy("id")
        .execute();

      for (const listing of listings) {
        if (result.proposed >= (input.maxProposals ?? 200)) return result;
        result.evaluated++;
        const { fingerprint } = await listingFingerprint(db, listing);
        const comparison = compare(fingerprint, candidate.fingerprint);
        if (comparison.vetoes.length > 0) {
          count(`veto:${comparison.vetoes[0]}`);
          continue;
        }
        // Otra línea o modelo con la misma clave (Renegade contra NV3): el preprocesador ya los distinguió.
        if (comparison.evidence.textMismatch) {
          count("texto_distinto");
          continue;
        }
        // Bajo la banda gris no hay nada que proponer: el matching ya los considera productos distintos.
        if (comparison.score < 0.6) {
          count("puntaje_bajo");
          continue;
        }
        const decided = await alreadyDecided(db, listing.id, keeper.id);
        if (decided) {
          count(decided);
          continue;
        }
        result.proposed++;
        if (result.samples.length < 20) {
          result.samples.push({
            listingId: listing.id,
            candidateProductId: keeper.id,
            score: comparison.score,
            title: listing.title,
            candidate: keeper.name,
          });
        }
        if (!input.dryRun) {
          await createReview(db, {
            listingId: listing.id,
            candidateProductId: keeper.id,
            score: comparison.score,
            evidence: {
              ...comparison.evidence,
              detector: "attribute_key",
              previousProductId: other.id,
              // Dato para quien revisa, no para el modelo: medido, 17 de 21 pares que comparten foto son productos
              // distintos (variantes de color y packs), así que decírselo al modelo lo empujaría a equivocarse.
              ...(keeper.image && other.image ? { sameImage: keeper.image === other.image } : {}),
            },
            now,
          });
        }
      }
    }
  }
  return result;
}
