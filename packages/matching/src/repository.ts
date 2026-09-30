import type { Category } from "@framerate/contracts";
import { type Db, type MatchMethod, parseJson, toJson } from "@framerate/database";
import { fold, slugify } from "@framerate/kit";
import { sql } from "kysely";
import type { Attributes } from "./domain/attributes";
import type { Candidate } from "./domain/decide";
import { buildFingerprint, type Fingerprint } from "./domain/fingerprint";

const MAX_CANDIDATES = 20;

type Identifiers = Pick<Fingerprint, "mpn" | "gtin">;

function identifierPairs(fp: Identifiers) {
  return [
    fp.mpn ? { kind: "mpn" as const, value: fp.mpn } : null,
    fp.gtin ? { kind: "gtin" as const, value: fp.gtin } : null,
  ].filter((x) => x !== null);
}

/**
 * Candidatos para una huella: productos que comparten identificador, clave de
 * atributos, o (misma categoría y marca) texto similar vía FTS.
 */
export async function findCandidates(db: Db, fp: Fingerprint): Promise<Candidate[]> {
  const ids = new Set<number>();

  const pairs = identifierPairs(fp);
  if (pairs.length > 0) {
    const rows = await db.query
      .selectFrom("product_identifiers")
      .select("product_id")
      .where((eb) => eb.or(pairs.map((p) => eb.and([eb("kind", "=", p.kind), eb("value", "=", p.value)]))))
      .execute();
    for (const r of rows) ids.add(r.product_id);
  }

  if (fp.attributeKey) {
    const rows = await db.query
      .selectFrom("products")
      .select("id")
      .where("attribute_key", "=", fp.attributeKey)
      .limit(MAX_CANDIDATES)
      .execute();
    for (const r of rows) ids.add(r.id);
  }

  if (fp.brand && fp.tokens.length > 0 && ids.size < MAX_CANDIDATES) {
    // Tokens entre comillas: FTS5 los trata como literales (sin operadores inyectables).
    const match = fp.tokens
      .slice(0, 8)
      .map((t) => `"${t.replace(/"/g, "")}"`)
      .join(" OR ");
    const brand = fp.brand;
    const rows = await db.query
      .selectFrom("products")
      .select("id")
      .where("category", "=", fp.category)
      .where("brand", "=", brand)
      .where(
        sql<boolean>`id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ${match} ORDER BY rank LIMIT ${MAX_CANDIDATES})`,
      )
      .limit(MAX_CANDIDATES)
      .execute();
    for (const r of rows) ids.add(r.id);
  }

  return loadCandidates(db, [...ids].slice(0, MAX_CANDIDATES), fp);
}

/** Reconstruye la huella de productos existentes. `offer` elige qué identificador comparar. */
export async function loadCandidates(db: Db, productIds: number[], offer: Identifiers): Promise<Candidate[]> {
  if (productIds.length === 0) return [];
  const [rows, identifiers] = await Promise.all([
    db.query.selectFrom("products").selectAll().where("id", "in", productIds).execute(),
    db.query.selectFrom("product_identifiers").selectAll().where("product_id", "in", productIds).execute(),
  ]);
  return rows.map((p): Candidate => {
    const own = identifiers.filter((i) => i.product_id === p.id);
    const mpns = own.filter((i) => i.kind === "mpn").map((i) => i.value);
    const gtins = own.filter((i) => i.kind === "gtin").map((i) => i.value);
    const base = buildFingerprint({ category: p.category as Category, title: p.name, brand: p.brand });
    return {
      productId: p.id,
      fingerprint: {
        ...base,
        brand: p.brand,
        // Un producto puede tener varios MPN (variantes regionales); se compara con el
        // que coincide con la oferta si existe, si no con cualquiera (→ conflicto).
        mpn: offer.mpn && mpns.includes(offer.mpn) ? offer.mpn : (mpns[0] ?? null),
        gtin: offer.gtin && gtins.includes(offer.gtin) ? offer.gtin : (gtins[0] ?? null),
        attributes: parseJson<Attributes>(p.attributes, {}),
        attributeKey: p.attribute_key,
      },
    };
  });
}

export async function createProduct(
  db: Db,
  input: { name: string; fingerprint: Fingerprint; imageUrl: string | null; now: string },
): Promise<{ id: number; identifierConflicts: string[] }> {
  const { fingerprint: fp } = input;
  const brandInName = fp.brand && fold(input.name).startsWith(fold(fp.brand));
  const slug = await uniqueSlug(db, brandInName || !fp.brand ? input.name : `${fp.brand} ${input.name}`);
  const row = await db.query
    .insertInto("products")
    .values({
      slug,
      name: input.name,
      brand: fp.brand,
      category: fp.category,
      attribute_key: fp.attributeKey,
      attributes: toJson(fp.attributes),
      image_url: input.imageUrl,
      created_at: input.now,
      updated_at: input.now,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const identifierConflicts = await attachIdentifiers(db, row.id, fp);
  return { id: row.id, identifierConflicts };
}

/**
 * Asocia MPN/GTIN al producto. Si otro producto ya es dueño del identificador,
 * NO se lo quita (la PK lo impide): se reporta como conflicto para revisión.
 */
export async function attachIdentifiers(db: Db, productId: number, fp: Identifiers): Promise<string[]> {
  const wanted = identifierPairs(fp);
  if (wanted.length === 0) return [];
  await db.query
    .insertInto("product_identifiers")
    .values(wanted.map((w) => ({ ...w, product_id: productId })))
    .onConflict((oc) => oc.doNothing())
    .execute();
  const owned = await db.query
    .selectFrom("product_identifiers")
    .selectAll()
    .where((eb) => eb.or(wanted.map((w) => eb.and([eb("kind", "=", w.kind), eb("value", "=", w.value)]))))
    .execute();
  return owned.filter((o) => o.product_id !== productId).map((o) => `${o.kind}:${o.value}`);
}

async function uniqueSlug(db: Db, text: string): Promise<string> {
  const base = slugify(text) || "producto";
  // Rango en vez de LIKE: D1 limita los patrones LIKE a 50 bytes. "base-" ≤ x < "base." cubre "base-N".
  const rows = await db.query
    .selectFrom("products")
    .select("slug")
    .where((eb) => eb.or([eb("slug", "=", base), eb.and([eb("slug", ">=", `${base}-`), eb("slug", "<", `${base}.`)])]))
    .execute();
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Vincula (o desvincula, con productId null) una oferta y deja la decisión auditada. */
export async function setListingProduct(
  db: Db,
  input: {
    listingId: number;
    productId: number | null;
    method: MatchMethod;
    confidence: number;
    evidence: Record<string, unknown>;
    decidedBy: string;
    now: string;
  },
) {
  await db.batch([
    db.query.updateTable("listings").set({ product_id: input.productId }).where("id", "=", input.listingId),
    db.query.insertInto("match_decisions").values({
      listing_id: input.listingId,
      product_id: input.productId,
      method: input.method,
      confidence: input.confidence,
      evidence: toJson(input.evidence),
      decided_by: input.decidedBy,
      created_at: input.now,
    }),
  ]);
}

export async function fillProductImage(db: Db, productId: number, imageUrl: string | null, now: string) {
  if (!imageUrl) return;
  await db.query
    .updateTable("products")
    .set({ image_url: imageUrl, updated_at: now })
    .where("id", "=", productId)
    .where("image_url", "is", null)
    .execute();
}

export async function createReview(
  db: Db,
  input: {
    listingId: number;
    candidateProductId: number;
    score: number;
    evidence: Record<string, unknown>;
    now: string;
  },
) {
  await db.query
    .insertInto("match_reviews")
    .values({
      listing_id: input.listingId,
      candidate_product_id: input.candidateProductId,
      score: input.score,
      evidence: toJson(input.evidence),
      status: "pending",
      created_at: input.now,
    })
    .onConflict((oc) => oc.doNothing())
    .execute();
}

export async function listPendingReviews(db: Db, limit: number) {
  const rows = await db.query
    .selectFrom("match_reviews as r")
    .innerJoin("listings as l", "l.id", "r.listing_id")
    .innerJoin("products as p", "p.id", "r.candidate_product_id")
    .select([
      "r.id",
      "r.score",
      "r.evidence",
      "r.created_at as createdAt",
      "l.id as listingId",
      "l.title as listingTitle",
      "l.url as listingUrl",
      "l.product_id as listingProductId",
      "p.id as candidateId",
      "p.slug as candidateSlug",
      "p.name as candidateName",
    ])
    .where("r.status", "=", "pending")
    .orderBy("r.score", "desc")
    .limit(limit)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    score: r.score,
    evidence: parseJson<Record<string, unknown>>(r.evidence, {}),
    createdAt: r.createdAt,
    listing: { id: r.listingId, title: r.listingTitle, url: r.listingUrl, productId: r.listingProductId },
    candidate: { id: r.candidateId, slug: r.candidateSlug, name: r.candidateName },
  }));
}

export async function getReview(db: Db, id: number) {
  return db.query.selectFrom("match_reviews").selectAll().where("id", "=", id).executeTakeFirst();
}

export async function resolveReview(db: Db, id: number, status: "accepted" | "rejected", now: string) {
  await db.query
    .updateTable("match_reviews")
    .set({ status, resolved_at: now })
    .where("id", "=", id)
    .where("status", "=", "pending")
    .execute();
}

export async function getListingIdentity(db: Db, listingId: number) {
  return db.query
    .selectFrom("listings")
    .select(["id", "product_id as productId", "category", "title", "brand", "mpn", "gtin"])
    .where("id", "=", listingId)
    .executeTakeFirst();
}

/** Traslada identificadores de un producto a otro (al fusionar por revisión humana). */
export async function moveIdentifiers(db: Db, fromProductId: number, toProductId: number, fp: Identifiers) {
  const pairs = identifierPairs(fp);
  if (pairs.length === 0) return;
  await db.query
    .updateTable("product_identifiers")
    .set({ product_id: toProductId })
    .where("product_id", "=", fromProductId)
    .where((eb) => eb.or(pairs.map((p) => eb.and([eb("kind", "=", p.kind), eb("value", "=", p.value)]))))
    .execute();
}
