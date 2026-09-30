import type { Category } from "@framerate/contracts";
import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import {
  listings,
  type MatchMethod,
  matchDecisions,
  matchReviews,
  productIdentifiers,
  products,
} from "@/shared/db/schema";
import { fold, slugify } from "@/shared/text";
import type { Attributes } from "./domain/attributes";
import type { Candidate } from "./domain/decide";
import { buildFingerprint, type Fingerprint } from "./domain/fingerprint";

const MAX_CANDIDATES = 20;

/**
 * Candidatos para una huella: productos que comparten identificador, clave de
 * atributos, o (misma categoría y marca) texto similar vía FTS.
 */
export async function findCandidates(db: Db, fp: Fingerprint): Promise<Candidate[]> {
  const ids = new Set<number>();

  const idConditions = [
    fp.mpn ? and(eq(productIdentifiers.kind, "mpn"), eq(productIdentifiers.value, fp.mpn)) : undefined,
    fp.gtin ? and(eq(productIdentifiers.kind, "gtin"), eq(productIdentifiers.value, fp.gtin)) : undefined,
  ].filter(Boolean);
  if (idConditions.length > 0) {
    const rows = await db
      .select({ productId: productIdentifiers.productId })
      .from(productIdentifiers)
      .where(or(...idConditions));
    for (const r of rows) ids.add(r.productId);
  }

  if (fp.attributeKey) {
    const rows = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.attributeKey, fp.attributeKey))
      .limit(MAX_CANDIDATES);
    for (const r of rows) ids.add(r.id);
  }

  if (fp.brand && fp.tokens.length > 0 && ids.size < MAX_CANDIDATES) {
    // Tokens entre comillas: FTS5 los trata como literales (sin operadores inyectables).
    const match = fp.tokens
      .slice(0, 8)
      .map((t) => `"${t.replace(/"/g, "")}"`)
      .join(" OR ");
    const rows = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.category, fp.category),
          eq(products.brand, fp.brand),
          sql`${products.id} IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ${match} ORDER BY rank LIMIT ${MAX_CANDIDATES})`,
        ),
      )
      .limit(MAX_CANDIDATES);
    for (const r of rows) ids.add(r.id);
  }

  return loadCandidates(db, [...ids].slice(0, MAX_CANDIDATES), fp);
}

/** Reconstruye la huella de productos existentes. `offer` elige qué identificador comparar. */
export async function loadCandidates(db: Db, productIds: number[], offer: Pick<Fingerprint, "mpn" | "gtin">) {
  if (productIds.length === 0) return [];
  const [rows, identifiers] = await Promise.all([
    db.select().from(products).where(inArray(products.id, productIds)),
    db.select().from(productIdentifiers).where(inArray(productIdentifiers.productId, productIds)),
  ]);
  return rows.map((p): Candidate => {
    const own = identifiers.filter((i) => i.productId === p.id);
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
        attributes: p.attributes as Attributes,
        attributeKey: p.attributeKey,
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
  const row = await db
    .insert(products)
    .values({
      slug,
      name: input.name,
      brand: fp.brand,
      category: fp.category,
      attributeKey: fp.attributeKey,
      attributes: fp.attributes,
      imageUrl: input.imageUrl,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning({ id: products.id })
    .get();
  const identifierConflicts = await attachIdentifiers(db, row.id, fp);
  return { id: row.id, identifierConflicts };
}

/**
 * Asocia MPN/GTIN al producto. Si otro producto ya es dueño del identificador,
 * NO se lo quita (la PK lo impide): se reporta como conflicto para revisión.
 */
export async function attachIdentifiers(db: Db, productId: number, fp: Pick<Fingerprint, "mpn" | "gtin">) {
  const wanted = [
    fp.mpn ? { kind: "mpn" as const, value: fp.mpn } : null,
    fp.gtin ? { kind: "gtin" as const, value: fp.gtin } : null,
  ].filter((x) => x !== null);
  if (wanted.length === 0) return [];
  await db
    .insert(productIdentifiers)
    .values(wanted.map((w) => ({ ...w, productId })))
    .onConflictDoNothing();
  const owned = await db
    .select()
    .from(productIdentifiers)
    .where(or(...wanted.map((w) => and(eq(productIdentifiers.kind, w.kind), eq(productIdentifiers.value, w.value)))));
  return owned.filter((o) => o.productId !== productId).map((o) => `${o.kind}:${o.value}`);
}

async function uniqueSlug(db: Db, text: string): Promise<string> {
  const base = slugify(text) || "producto";
  // Rango en vez de LIKE: D1 limita los patrones LIKE a 50 bytes. "base-" ≤ x < "base." cubre "base-N".
  const taken = new Set(
    (
      await db
        .select({ slug: products.slug })
        .from(products)
        .where(or(eq(products.slug, base), and(gte(products.slug, `${base}-`), lt(products.slug, `${base}.`))))
    ).map((r) => r.slug),
  );
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
    db.update(listings).set({ productId: input.productId }).where(eq(listings.id, input.listingId)),
    db.insert(matchDecisions).values({
      listingId: input.listingId,
      productId: input.productId,
      method: input.method,
      confidence: input.confidence,
      evidence: input.evidence,
      decidedBy: input.decidedBy,
      createdAt: input.now,
    }),
  ]);
}

export async function fillProductImage(db: Db, productId: number, imageUrl: string | null, now: string) {
  if (!imageUrl) return;
  await db
    .update(products)
    .set({ imageUrl, updatedAt: now })
    .where(and(eq(products.id, productId), sql`${products.imageUrl} IS NULL`));
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
  await db
    .insert(matchReviews)
    .values({ ...input, status: "pending", createdAt: input.now })
    .onConflictDoNothing();
}

export async function listPendingReviews(db: Db, limit: number) {
  const reviews = await db
    .select({
      id: matchReviews.id,
      score: matchReviews.score,
      evidence: matchReviews.evidence,
      createdAt: matchReviews.createdAt,
      listing: { id: listings.id, title: listings.title, url: listings.url, productId: listings.productId },
      candidate: { id: products.id, slug: products.slug, name: products.name },
    })
    .from(matchReviews)
    .innerJoin(listings, eq(listings.id, matchReviews.listingId))
    .innerJoin(products, eq(products.id, matchReviews.candidateProductId))
    .where(eq(matchReviews.status, "pending"))
    .orderBy(desc(matchReviews.score))
    .limit(limit);
  return reviews;
}

export async function getReview(db: Db, id: number) {
  return db.select().from(matchReviews).where(eq(matchReviews.id, id)).get();
}

export async function resolveReview(db: Db, id: number, status: "accepted" | "rejected", now: string) {
  await db
    .update(matchReviews)
    .set({ status, resolvedAt: now })
    .where(and(eq(matchReviews.id, id), eq(matchReviews.status, "pending")));
}

export async function getListingIdentity(db: Db, listingId: number) {
  return db
    .select({
      id: listings.id,
      productId: listings.productId,
      category: listings.category,
      title: listings.title,
      brand: listings.brand,
      mpn: listings.mpn,
      gtin: listings.gtin,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .get();
}

/** Traslada identificadores de un producto a otro (al fusionar por revisión humana). */
export async function moveIdentifiers(
  db: Db,
  fromProductId: number,
  toProductId: number,
  fp: Pick<Fingerprint, "mpn" | "gtin">,
) {
  const wanted = [
    fp.mpn ? and(eq(productIdentifiers.kind, "mpn"), eq(productIdentifiers.value, fp.mpn)) : undefined,
    fp.gtin ? and(eq(productIdentifiers.kind, "gtin"), eq(productIdentifiers.value, fp.gtin)) : undefined,
  ].filter(Boolean);
  if (wanted.length === 0) return;
  await db
    .update(productIdentifiers)
    .set({ productId: toProductId })
    .where(and(eq(productIdentifiers.productId, fromProductId), or(...wanted)));
}
