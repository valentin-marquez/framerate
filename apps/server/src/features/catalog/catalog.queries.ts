import type {
  Category,
  Offer,
  PricePoint,
  ProductDetail,
  ProductListQuery,
  ProductPage,
  ProductSummary,
} from "@framerate/contracts";
import { and, asc, count, desc, eq, gte, isNotNull, type SQL, sql } from "drizzle-orm";
import { titleTokens } from "@/features/matching/domain/fingerprint";
import type { Db } from "@/shared/db/client";
import { listings, pricePoints, products, stores } from "@/shared/db/schema";

/**
 * Consultas de lectura del catálogo público. Sólo se muestran productos con
 * al menos una oferta activa; precios agregados sobre ofertas activas.
 */

function offerAggregate(db: Db) {
  return db
    .select({
      productId: sql<number>`${listings.productId}`.as("agg_product_id"),
      bestPrice: sql<number | null>`min(case when ${listings.inStock} = 1 then ${listings.priceCash} end)`.as(
        "best_price",
      ),
      offerCount: count().as("offer_count"),
    })
    .from(listings)
    .where(and(eq(listings.isActive, true), isNotNull(listings.productId)))
    .groupBy(listings.productId)
    .as("agg");
}

/** Convierte texto libre en una consulta FTS5 segura: cada palabra como prefijo literal. */
export function ftsQuery(q: string): string | null {
  const tokens = titleTokens(q).slice(0, 8);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

export async function listProducts(db: Db, query: ProductListQuery): Promise<ProductPage> {
  const agg = offerAggregate(db);
  const filters: SQL[] = [];
  if (query.category) filters.push(eq(products.category, query.category));
  if (query.brand) filters.push(sql`lower(${products.brand}) = lower(${query.brand})`);
  if (query.inStock) filters.push(isNotNull(agg.bestPrice));
  if (query.q) {
    const match = ftsQuery(query.q);
    if (!match) return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
    filters.push(sql`${products.id} IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ${match})`);
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const priceNullsLast = sql`${agg.bestPrice} IS NULL`;
  const orderBy = {
    relevance: [desc(agg.offerCount), asc(priceNullsLast), asc(agg.bestPrice), asc(products.name)],
    price_asc: [asc(priceNullsLast), asc(agg.bestPrice), asc(products.name)],
    price_desc: [asc(priceNullsLast), desc(agg.bestPrice), asc(products.name)],
    newest: [desc(products.createdAt), asc(products.id)],
  }[query.sort];

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        slug: products.slug,
        name: products.name,
        brand: products.brand,
        category: products.category,
        imageUrl: products.imageUrl,
        bestPrice: agg.bestPrice,
        offerCount: agg.offerCount,
      })
      .from(products)
      .innerJoin(agg, eq(agg.productId, products.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(products).innerJoin(agg, eq(agg.productId, products.id)).where(where).get(),
  ]);

  return {
    items: rows.map((r) => ({ ...r, category: r.category as Category })),
    page: query.page,
    pageSize: query.pageSize,
    total: totalRow?.total ?? 0,
  };
}

export async function getProduct(db: Db, slug: string): Promise<ProductDetail | null> {
  const product = await db.select().from(products).where(eq(products.slug, slug)).get();
  if (!product) return null;

  const offerRows = await db
    .select({
      store: { slug: stores.slug, name: stores.name, url: stores.url },
      url: listings.url,
      title: listings.title,
      priceCash: listings.priceCash,
      priceCard: listings.priceCard,
      inStock: listings.inStock,
      stockQuantity: listings.stockQuantity,
      lastSeenAt: listings.lastSeenAt,
      isActive: listings.isActive,
    })
    .from(listings)
    .innerJoin(stores, eq(stores.id, listings.storeId))
    .where(eq(listings.productId, product.id))
    .orderBy(desc(listings.inStock), asc(listings.priceCash));

  // Un producto sin ninguna oferta (ej. provisional fusionado por revisión) no existe públicamente.
  if (offerRows.length === 0) return null;

  const offers: Offer[] = offerRows.filter((o) => o.isActive).map(({ isActive: _, ...o }) => o);
  const inStock = offers.filter((o) => o.inStock);
  const summary: ProductSummary = {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category as Category,
    imageUrl: product.imageUrl,
    bestPrice: inStock.length > 0 ? Math.min(...inStock.map((o) => o.priceCash)) : null,
    offerCount: offers.length,
  };
  return { ...summary, attributes: product.attributes as ProductDetail["attributes"], offers };
}

export async function getPriceHistory(db: Db, slug: string, days: number): Promise<PricePoint[] | null> {
  const product = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).get();
  if (!product) return null;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return db
    .select({
      store: stores.slug,
      priceCash: pricePoints.priceCash,
      priceCard: pricePoints.priceCard,
      inStock: pricePoints.inStock,
      observedAt: pricePoints.observedAt,
    })
    .from(pricePoints)
    .innerJoin(listings, eq(listings.id, pricePoints.listingId))
    .innerJoin(stores, eq(stores.id, listings.storeId))
    .where(and(eq(listings.productId, product.id), gte(pricePoints.observedAt, since)))
    .orderBy(asc(pricePoints.observedAt));
}

export async function listStores(db: Db) {
  return db
    .select({ slug: stores.slug, name: stores.name, url: stores.url, offerCount: count(listings.id) })
    .from(stores)
    .leftJoin(listings, and(eq(listings.storeId, stores.id), eq(listings.isActive, true)))
    .where(eq(stores.isActive, true))
    .groupBy(stores.id)
    .orderBy(asc(stores.name));
}

export async function categoryCounts(db: Db) {
  return db
    .select({ category: listings.category, products: sql<number>`count(distinct ${listings.productId})` })
    .from(listings)
    .where(and(eq(listings.isActive, true), isNotNull(listings.productId)))
    .groupBy(listings.category);
}
