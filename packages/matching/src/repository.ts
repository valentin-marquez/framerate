import type { Category, ListingIdentity } from "@framerate/contracts";
import { bumpCatalogVersionQuery, type Db, type MatchMethod, parseJson, toJson } from "@framerate/database";
import { fold, searchText, slugify } from "@framerate/kit";
import { sql } from "kysely";
import type { Attributes } from "./domain/attributes";
import { type Candidate, compare } from "./domain/decide";
import { familyKey } from "./domain/family";
import {
  attributeKey,
  buildFingerprint,
  type Fingerprint,
  fingerprintFromIdentity,
  storedFingerprint,
} from "./domain/fingerprint";
import { normalizeGtin, normalizeMpn } from "./domain/identifiers";

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

export interface CatalogCandidate {
  id: number;
  name: string;
  mpns: string[];
  /** Tiendas que lo venden: Haiku elige el primero entre duplicados, y van ordenados por esto. */
  offers: number;
}

const CATALOG_CANDIDATES = 8;

/**
 * Lo que el preprocesador le muestra a Haiku para que decida si la oferta ya está en el catálogo (#157): su ficha
 * actual, los dueños de su MPN o GTIN y los más parecidos por texto en la misma categoría, con más tiendas primero.
 * Sin marca: la de la tienda no siempre es la canónica.
 */
export async function catalogCandidates(
  db: Db,
  offer: { category: Category; title: string; mpn: string | null; gtin?: string | null; productId?: number | null },
): Promise<CatalogCandidate[]> {
  const ids: number[] = [];
  if (offer.productId) ids.push(offer.productId);
  const pairs = identifierPairs({ mpn: normalizeMpn(offer.mpn), gtin: normalizeGtin(offer.gtin) });
  if (pairs.length > 0) {
    const owners = await db.query
      .selectFrom("product_identifiers")
      .select("product_id")
      .where((eb) => eb.or(pairs.map((p) => eb.and([eb("kind", "=", p.kind), eb("value", "=", p.value)]))))
      .execute();
    ids.push(...owners.map((r) => r.product_id));
  }
  const tokens = [...new Set(searchText(offer.title).split(" "))].filter((t) => t.length > 1).slice(0, 16);
  if (tokens.length > 0) {
    const match = tokens.map((t) => `"${t}"`).join(" OR ");
    const { rows } = await sql<{
      id: number;
    }>`SELECT p.id FROM products_fts JOIN products p ON p.id = products_fts.rowid
      WHERE products_fts MATCH ${match} AND p.category = ${offer.category} ORDER BY products_fts.rank
      LIMIT ${CATALOG_CANDIDATES}`.execute(db.query);
    ids.push(...rows.map((r) => r.id));
  }
  const unique = [...new Set(ids)].slice(0, CATALOG_CANDIDATES + 1);
  if (unique.length === 0) return [];
  const [products, identifiers] = await Promise.all([
    db.query.selectFrom("products").select(["id", "name", "offer_count"]).where("id", "in", unique).execute(),
    db.query
      .selectFrom("product_identifiers")
      .select(["product_id", "value"])
      .where("product_id", "in", unique)
      .where("kind", "=", "mpn")
      .execute(),
  ]);
  return unique
    .flatMap((id) => {
      const p = products.find((x) => x.id === id);
      if (!p) return [];
      const mpns = identifiers.filter((i) => i.product_id === id).map((i) => i.value);
      return [{ id, name: p.name, mpns: mpns.slice(0, 3), offers: p.offer_count }];
    })
    .sort((a, b) => b.offers - a.offers);
}

/** Productos, salvo `exceptProductId`, dueños de un identificador de la huella. */
export async function identifierOwners(db: Db, fp: Identifiers, exceptProductId: number): Promise<number[]> {
  const pairs = identifierPairs(fp);
  if (pairs.length === 0) return [];
  const rows = await db.query
    .selectFrom("product_identifiers")
    .select("product_id")
    .where("product_id", "!=", exceptProductId)
    .where((eb) => eb.or(pairs.map((p) => eb.and([eb("kind", "=", p.kind), eb("value", "=", p.value)]))))
    .execute();
  return [...new Set(rows.map((r) => r.product_id))];
}

/** Marca los candidatos que ya tienen otra oferta activa de la misma tienda que `listingId`. */
export async function markSameStore(db: Db, listingId: number, candidates: Candidate[]): Promise<Candidate[]> {
  if (candidates.length === 0) return candidates;
  const rows = await db.query
    .selectFrom("listings as l")
    .innerJoin("listings as self", "self.store_id", "l.store_id")
    .select("l.product_id")
    .where("self.id", "=", listingId)
    .where("l.id", "!=", listingId)
    .where("l.is_active", "=", 1)
    .where(
      "l.product_id",
      "in",
      candidates.map((c) => c.productId),
    )
    .execute();
  const same = new Set(rows.map((r) => r.product_id));
  return candidates.map((c) => ({ ...c, sameStore: same.has(c.productId) }));
}

/**
 * Huella de productos existentes: la guardada es la verdad (spec §5.2), venga de la identidad de Haiku o del regex
 * con que se creó. Antes, un producto sin ofertas de identidad se reconstruía desde el nombre en cada carga y eso
 * pisaba las huellas restauradas a mano ("z890m plus" volvía a "z890m"). `offer` elige qué identificador comparar;
 * `ignore` deja fuera los que sólo aportó esa oferta.
 */
export async function loadCandidates(
  db: Db,
  productIds: number[],
  offer: Identifiers,
  ignore?: Identifiers,
): Promise<Candidate[]> {
  if (productIds.length === 0) return [];
  const [rows, identifiers] = await Promise.all([
    db.query.selectFrom("products").selectAll().where("id", "in", productIds).execute(),
    db.query.selectFrom("product_identifiers").selectAll().where("product_id", "in", productIds).execute(),
  ]);
  return rows.map((p): Candidate => {
    const own = identifiers.filter((i) => i.product_id === p.id && ignore?.[i.kind] !== i.value);
    const mpns = own.filter((i) => i.kind === "mpn").map((i) => i.value);
    const gtins = own.filter((i) => i.kind === "gtin").map((i) => i.value);
    const stored = parseJson<Attributes>(p.attributes, {});
    const category = p.category as Category;
    // Sin huella guardada (filas de antes de que se escribiera al crear) se deduce del nombre, pero no se escribe.
    const base =
      Object.keys(stored).length > 0
        ? storedFingerprint({
            category,
            name: p.name,
            brand: p.brand,
            attributes: stored,
            attributeKey: p.attribute_key,
          })
        : buildFingerprint({ category, title: p.name, brand: p.brand });
    return {
      productId: p.id,
      fingerprint: {
        ...base,
        // Un producto puede tener varios MPN (variantes regionales); se compara con el
        // que coincide con la oferta si existe, si no con cualquiera (→ conflicto).
        mpn: offer.mpn && mpns.includes(offer.mpn) ? offer.mpn : (mpns[0] ?? null),
        gtin: offer.gtin && gtins.includes(offer.gtin) ? offer.gtin : (gtins[0] ?? null),
      },
    };
  });
}

export interface LinkState {
  /** Última decisión de la oferta: `manual` no se re-decide; `new_product` es la fundadora del producto. */
  method: MatchMethod | null;
  /** El producto ya tiene una oferta activa más antigua de la misma tienda. */
  olderSameStore: boolean;
  /** Identificadores que publican las demás ofertas del producto. */
  others: Identifiers[];
}

export async function loadLinkState(db: Db, listingId: number, productId: number): Promise<LinkState> {
  const rows = await db.query
    .selectFrom("listings as l")
    .select((eb) => [
      "l.id",
      "l.store_id as storeId",
      "l.is_active as isActive",
      "l.mpn",
      "l.gtin",
      eb
        .selectFrom("match_decisions as d")
        .select("d.method")
        .whereRef("d.listing_id", "=", "l.id")
        .orderBy("d.id", "desc")
        .limit(1)
        .as("method"),
    ])
    .where("l.product_id", "=", productId)
    .execute();
  const self = rows.find((r) => r.id === listingId);
  const others = rows.filter((r) => r.id !== listingId);
  return {
    method: self?.method ?? null,
    olderSameStore: others.some((r) => r.storeId === self?.storeId && r.id < listingId && r.isActive === 1),
    others,
  };
}

/**
 * Le quita al producto los identificadores de una oferta que ya se desvinculó, salvo los que todavía publica otra
 * oferta del producto. La condición va dentro del DELETE: dos crawls en paralelo no se pisan entre la lectura y el
 * borrado.
 */
export async function detachIdentifiers(db: Db, productId: number, fp: Identifiers) {
  const pairs = identifierPairs(fp);
  if (pairs.length === 0) return;
  await db.query
    .deleteFrom("product_identifiers")
    .where("product_id", "=", productId)
    .where((eb) =>
      eb.or(
        pairs.map((p) =>
          eb.and([
            eb("kind", "=", p.kind),
            eb("value", "=", p.value),
            eb.not(
              eb.exists(
                eb
                  .selectFrom("listings")
                  .select("listings.id")
                  .where("listings.product_id", "=", productId)
                  .where(`listings.${p.kind}`, "=", p.value),
              ),
            ),
          ]),
        ),
      ),
    )
    .execute();
}

/**
 * Le quita al producto los MPN y GTIN que ninguna de sus ofertas publica ya (la tienda cambió el código y el viejo
 * quedó, #99). Un MPN cuenta como publicado si lo trae `listings.mpn` o lo que Haiku leyó de la oferta en su última
 * versión (`listing_identity.mpn`): la huella también lo toma de ahí.
 */
export async function pruneStaleIdentifiers(db: Db, productId: number) {
  const [stored, listings, identities] = await Promise.all([
    db.query.selectFrom("product_identifiers").selectAll().where("product_id", "=", productId).execute(),
    db.query.selectFrom("listings").select(["mpn", "gtin"]).where("product_id", "=", productId).execute(),
    db.query
      .selectFrom("listing_identity as i")
      .innerJoin("listings as l", "l.id", "i.listing_id")
      .select("i.mpn")
      .where("l.product_id", "=", productId)
      .where((eb) =>
        eb(
          "i.version",
          "=",
          eb
            .selectFrom("listing_identity as v")
            .select((e) => e.fn.max("v.version").as("latest"))
            .whereRef("v.listing_id", "=", "i.listing_id"),
        ),
      )
      .execute(),
  ]);
  if (stored.length === 0) return;
  const published = new Set([
    ...listings.flatMap((l) => [`mpn:${normalizeMpn(l.mpn)}`, `gtin:${normalizeGtin(l.gtin)}`]),
    ...identities.map((i) => `mpn:${normalizeMpn(i.mpn)}`),
  ]);
  const stale = stored.filter((s) => !published.has(`${s.kind}:${s.value}`));
  if (stale.length === 0) return;
  await db.query
    .deleteFrom("product_identifiers")
    .where("product_id", "=", productId)
    .where((eb) => eb.or(stale.map((s) => eb.and([eb("kind", "=", s.kind), eb("value", "=", s.value)]))))
    .execute();
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
      search: searchText(input.name),
      brand: fp.brand,
      category: fp.category,
      attribute_key: fp.attributeKey,
      family_key: familyKey(fp.category, fp.attributes),
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

/**
 * Completa la huella del producto con la de una oferta vinculada desde su identidad (spec §5.2): cada atributo que
 * el producto no tiene toma el de la oferta; nunca pisa uno existente (una contradicción es veto y no llega aquí).
 */
export async function fillProductAttributes(db: Db, productId: number, fp: Fingerprint, now: string) {
  const p = await db.query
    .selectFrom("products")
    .select(["category", "brand", "attributes", "attribute_key"])
    .where("id", "=", productId)
    .executeTakeFirst();
  if (!p) return;
  const merged = parseJson<Attributes>(p.attributes, {});
  for (const [field, value] of Object.entries(fp.attributes)) merged[field] ??= value;
  const brand = p.brand ?? fp.brand;
  const attributes = toJson(merged);
  const key = attributeKey(p.category as Category, brand, merged);
  if (attributes === p.attributes && key === p.attribute_key && brand === p.brand) return;
  await db.query
    .updateTable("products")
    .set({
      attributes,
      attribute_key: key,
      family_key: familyKey(p.category as Category, merged),
      brand,
      updated_at: now,
    })
    .where("id", "=", productId)
    .execute();
}

/**
 * Una oferta vinculada sale a la luz y publica su producto si era la primera visible (spec §8). Devuelve si algo
 * cambió para el catálogo; la versión sube en la misma transacción.
 */
export async function publishListing(db: Db, listingId: number, now: string): Promise<boolean> {
  const row = await db.query
    .selectFrom("listings")
    .select(["visible", "product_id"])
    .where("id", "=", listingId)
    .executeTakeFirst();
  if (!row || row.product_id === null) return false;
  const hidden = row.visible === 0;
  await db.batch([
    db.query.updateTable("listings").set({ visible: 1 }).where("id", "=", listingId),
    db.query
      .updateTable("products")
      .set({ published_at: now })
      .where("id", "=", row.product_id)
      .where("published_at", "is", null),
    ...(hidden ? [{ compile: () => bumpCatalogVersionQuery }] : []),
  ]);
  return hidden;
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
    .innerJoin("stores as s", "s.id", "l.store_id")
    .innerJoin("products as p", "p.id", "r.candidate_product_id")
    .select([
      "r.id",
      "r.score",
      "r.evidence",
      "r.created_at as createdAt",
      "l.id as listingId",
      "l.title as listingTitle",
      "l.url as listingUrl",
      "l.price_cash as listingPriceCash",
      "l.price_card as listingPriceCard",
      "l.in_stock as listingInStock",
      "l.image_url as listingImageUrl",
      "l.mpn as listingMpn",
      "l.gtin as listingGtin",
      "l.product_id as listingProductId",
      "s.slug as storeSlug",
      "s.name as storeName",
      "p.id as candidateId",
      "p.slug as candidateSlug",
      "p.name as candidateName",
      "p.brand as candidateBrand",
      "p.category as candidateCategory",
      "p.image_url as candidateImageUrl",
    ])
    .where("r.status", "=", "pending")
    // La de una oferta que la tienda dejó de publicar vuelve sola si la oferta vuelve (#100).
    .where("l.is_active", "=", 1)
    // Con veredicto de framerate-match (#117), lo más probable de ser el mismo producto primero; sin él, al final.
    .orderBy(sql`coalesce(min(json_extract(r.evidence, '$.ai.pAB'), json_extract(r.evidence, '$.ai.pBA')), -1)`, "desc")
    .orderBy("r.score", "desc")
    .limit(limit)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    score: r.score,
    evidence: parseJson<Record<string, unknown>>(r.evidence, {}),
    createdAt: r.createdAt,
    listing: {
      id: r.listingId,
      title: r.listingTitle,
      url: r.listingUrl,
      priceCash: r.listingPriceCash,
      priceCard: r.listingPriceCard,
      inStock: r.listingInStock === 1,
      imageUrl: r.listingImageUrl,
      mpn: r.listingMpn,
      gtin: r.listingGtin,
      productId: r.listingProductId,
      store: { slug: r.storeSlug, name: r.storeName },
    },
    candidate: {
      id: r.candidateId,
      slug: r.candidateSlug,
      name: r.candidateName,
      brand: r.candidateBrand,
      category: r.candidateCategory,
      imageUrl: r.candidateImageUrl,
    },
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

/**
 * Cierra la revisión pendiente de una oferta cuando ya no hay nada que decidir: el matching de hoy veta el par
 * (rejected) o la oferta ya está en el candidato sin veto (accepted). Sin esto, las revisiones viejas quedan para siempre y
 * bloquean la nueva (hay una sola pendiente por oferta).
 */
export async function closeObsoleteReview(
  db: Db,
  listingId: number,
  offer: Fingerprint,
  now: string,
): Promise<"accepted" | "rejected" | null> {
  const review = await db.query
    .selectFrom("match_reviews as r")
    .innerJoin("listings as l", "l.id", "r.listing_id")
    .select(["r.id", "r.candidate_product_id as candidateId", "l.product_id as productId"])
    .where("r.listing_id", "=", listingId)
    .where("r.status", "=", "pending")
    .executeTakeFirst();
  if (!review) return null;
  const [candidate] = await loadCandidates(db, [review.candidateId], offer);
  const vetoed = !candidate || compare(offer, candidate.fingerprint).vetoes.length > 0;
  const status = vetoed ? "rejected" : review.productId === review.candidateId ? "accepted" : null;
  if (status) await resolveReview(db, review.id, status, now);
  return status;
}

export async function getListingIdentity(db: Db, listingId: number) {
  return db.query
    .selectFrom("listings")
    .select([
      "id",
      "product_id as productId",
      "category",
      "title",
      "brand",
      "mpn",
      "gtin",
      "image_url as imageUrl",
      "visible",
    ])
    .where("id", "=", listingId)
    .executeTakeFirst();
}

/**
 * La huella de una oferta tal como la ve el matching (#156): desde su última identidad de Haiku, con los códigos del
 * campo de la tienda. Sólo una oferta sin identidad (todavía `pending`, o `failed`) se deduce del título con los
 * extractores, y esa huella es provisoria.
 */
export async function listingFingerprint(
  db: Db,
  listing: {
    id: number;
    category: string;
    title: string;
    brand: string | null;
    mpn: string | null;
    gtin: string | null;
  },
): Promise<{ fingerprint: Fingerprint; fromIdentity: boolean; canonicalName: string | null }> {
  const row = await db.query
    .selectFrom("listing_identity")
    .select(["category", "brand", "name", "mpn", "confidence", "identity"])
    .where("listing_id", "=", listing.id)
    .orderBy("version", "desc")
    .limit(1)
    .executeTakeFirst();
  if (row) {
    const identity: ListingIdentity = {
      category: row.category as Category,
      brand: row.brand,
      name: row.name,
      mpn: row.mpn,
      confidence: row.confidence as ListingIdentity["confidence"],
      identity: parseJson(row.identity, {}),
    };
    return {
      fingerprint: fingerprintFromIdentity({ identity, mpn: listing.mpn, gtin: listing.gtin }),
      fromIdentity: true,
      canonicalName: row.name,
    };
  }
  const category = listing.category as Category;
  return {
    fingerprint: buildFingerprint({
      category,
      title: listing.title,
      brand: listing.brand,
      mpn: listing.mpn,
      gtin: listing.gtin,
    }),
    fromIdentity: false,
    canonicalName: null,
  };
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

export type OverrideKind = "force" | "forbid";

export async function addOverride(
  db: Db,
  input: { listingId: number; productId: number; kind: OverrideKind; createdBy: string; now: string },
) {
  await db.query
    .insertInto("match_overrides")
    .values({
      listing_id: input.listingId,
      product_id: input.productId,
      kind: input.kind,
      created_by: input.createdBy,
      created_at: input.now,
    })
    .onConflict((oc) => oc.columns(["listing_id", "product_id"]).doUpdateSet({ kind: input.kind }))
    .execute();
}

/** Marca los candidatos con su override y suma los `force` que la búsqueda por similitud no encontró. */
export async function applyOverrides(
  db: Db,
  listingId: number,
  fp: Fingerprint,
  candidates: Candidate[],
): Promise<Candidate[]> {
  const rows = await db.query
    .selectFrom("match_overrides")
    .select(["product_id", "kind"])
    .where("listing_id", "=", listingId)
    .execute();
  if (rows.length === 0) return candidates;
  const kinds = new Map(rows.map((r) => [r.product_id, r.kind]));
  const known = new Set(candidates.map((c) => c.productId));
  const missing = rows.filter((r) => r.kind === "force" && !known.has(r.product_id)).map((r) => r.product_id);
  const all = [...candidates, ...(await loadCandidates(db, missing, fp))];
  return all.map((c) => ({ ...c, override: kinds.get(c.productId) }));
}

export async function overrideKind(db: Db, listingId: number, productId: number): Promise<OverrideKind | null> {
  const row = await db.query
    .selectFrom("match_overrides")
    .select("kind")
    .where("listing_id", "=", listingId)
    .where("product_id", "=", productId)
    .executeTakeFirst();
  return row?.kind ?? null;
}
