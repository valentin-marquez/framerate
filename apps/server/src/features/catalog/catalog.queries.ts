import type {
  Category,
  Offer,
  PricePoint,
  ProductDetail,
  ProductListQuery,
  ProductPage,
  ProductSummary,
} from "@framerate/contracts";
import type { Database, Db } from "@framerate/database";
import { parseJson, toBool } from "@framerate/database";
import { titleTokens } from "@framerate/matching";
import { type ExpressionBuilder, sql } from "kysely";

/**
 * Consultas de lectura del catálogo público. Sólo se muestran productos con
 * al menos una oferta activa; precios agregados sobre ofertas activas.
 */

/** Convierte texto libre en una consulta FTS5 segura: cada palabra como prefijo literal. */
export function ftsQuery(q: string): string | null {
  const tokens = titleTokens(q).slice(0, 8);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

/** Agregado por producto sobre ofertas activas: mejor precio con stock y cantidad de ofertas. */
function offerAggregate(db: Db) {
  return db.query
    .selectFrom("listings")
    .select((eb) => [
      "product_id",
      sql<number | null>`min(case when in_stock = 1 then price_cash end)`.as("best_price"),
      eb.fn.countAll<number>().as("offer_count"),
    ])
    .where("is_active", "=", 1)
    .where("product_id", "is not", null)
    .groupBy("product_id")
    .as("agg");
}

export async function listProducts(db: Db, query: ProductListQuery): Promise<ProductPage> {
  let match: string | null = null;
  if (query.q) {
    match = ftsQuery(query.q);
    if (!match) return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
  }

  let base = db.query.selectFrom("products as p").innerJoin(offerAggregate(db), "agg.product_id", "p.id");
  if (query.category) base = base.where("p.category", "=", query.category);
  if (query.brand) base = base.where(sql<boolean>`lower(p.brand) = lower(${query.brand})`);
  if (query.inStock) base = base.where("agg.best_price", "is not", null);
  if (match)
    base = base.where(sql<boolean>`p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ${match})`);

  const nullsLast = sql`agg.best_price IS NULL`;
  let page = base.select([
    "p.slug",
    "p.name",
    "p.brand",
    "p.category",
    "p.image_url as imageUrl",
    "agg.best_price as bestPrice",
    "agg.offer_count as offerCount",
  ]);
  switch (query.sort) {
    case "relevance":
      page = page.orderBy("agg.offer_count", "desc").orderBy(nullsLast).orderBy("agg.best_price").orderBy("p.name");
      break;
    case "price_asc":
      page = page.orderBy(nullsLast).orderBy("agg.best_price").orderBy("p.name");
      break;
    case "price_desc":
      page = page.orderBy(nullsLast).orderBy("agg.best_price", "desc").orderBy("p.name");
      break;
    case "newest":
      page = page.orderBy("p.created_at", "desc").orderBy("p.id");
      break;
  }

  const [rows, totalRow] = await Promise.all([
    page
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .execute(),
    base.select((eb) => eb.fn.countAll<number>().as("total")).executeTakeFirst(),
  ]);

  return {
    items: rows.map((r) => ({ ...r, category: r.category as Category, offerCount: Number(r.offerCount) })),
    page: query.page,
    pageSize: query.pageSize,
    total: Number(totalRow?.total ?? 0),
  };
}

const productBySlug = (slug: string) => (eb: ExpressionBuilder<Database, "products">) => eb("slug", "=", slug);

export async function getProduct(db: Db, slug: string): Promise<ProductDetail | null> {
  const product = await db.query.selectFrom("products").selectAll().where(productBySlug(slug)).executeTakeFirst();
  if (!product) return null;

  const offerRows = await db.query
    .selectFrom("listings as l")
    .innerJoin("stores as s", "s.id", "l.store_id")
    .select([
      "s.slug as storeSlug",
      "s.name as storeName",
      "s.url as storeUrl",
      "l.url",
      "l.title",
      "l.price_cash",
      "l.price_card",
      "l.in_stock",
      "l.stock_quantity",
      "l.last_seen_at",
      "l.is_active",
    ])
    .where("l.product_id", "=", product.id)
    .orderBy("l.in_stock", "desc")
    .orderBy("l.price_cash")
    .execute();

  // Un producto sin ninguna oferta (ej. provisional fusionado por revisión) no existe públicamente.
  if (offerRows.length === 0) return null;

  const offers: Offer[] = offerRows
    .filter((o) => toBool(o.is_active))
    .map((o) => ({
      store: { slug: o.storeSlug, name: o.storeName, url: o.storeUrl },
      url: o.url,
      title: o.title,
      priceCash: o.price_cash,
      priceCard: o.price_card,
      inStock: toBool(o.in_stock),
      stockQuantity: o.stock_quantity,
      lastSeenAt: o.last_seen_at,
    }));
  const inStock = offers.filter((o) => o.inStock);
  const summary: ProductSummary = {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category as Category,
    imageUrl: product.image_url,
    bestPrice: inStock.length > 0 ? Math.min(...inStock.map((o) => o.priceCash)) : null,
    offerCount: offers.length,
  };
  return { ...summary, attributes: parseJson<ProductDetail["attributes"]>(product.attributes, {}), offers };
}

export async function getPriceHistory(db: Db, slug: string, days: number): Promise<PricePoint[] | null> {
  const product = await db.query.selectFrom("products").select("id").where(productBySlug(slug)).executeTakeFirst();
  if (!product) return null;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await db.query
    .selectFrom("price_points as pp")
    .innerJoin("listings as l", "l.id", "pp.listing_id")
    .innerJoin("stores as s", "s.id", "l.store_id")
    .select(["s.slug as store", "pp.price_cash", "pp.price_card", "pp.in_stock", "pp.observed_at"])
    .where("l.product_id", "=", product.id)
    .where("pp.observed_at", ">=", since)
    .orderBy("pp.observed_at")
    .orderBy("pp.id")
    .execute();
  return rows.map((r) => ({
    store: r.store,
    priceCash: r.price_cash,
    priceCard: r.price_card,
    inStock: toBool(r.in_stock),
    observedAt: r.observed_at,
  }));
}

export async function listStores(db: Db) {
  const rows = await db.query
    .selectFrom("stores as s")
    .leftJoin("listings as l", (join) => join.onRef("l.store_id", "=", "s.id").on("l.is_active", "=", 1))
    .select((eb) => ["s.slug", "s.name", "s.url", eb.fn.count<number>("l.id").as("offerCount")])
    .where("s.is_active", "=", 1)
    .groupBy("s.id")
    .orderBy("s.name")
    .execute();
  return rows.map((r) => ({ ...r, offerCount: Number(r.offerCount) }));
}

export async function categoryCounts(db: Db) {
  const rows = await db.query
    .selectFrom("listings")
    .select(["category", sql<number>`count(distinct product_id)`.as("products")])
    .where("is_active", "=", 1)
    .where("product_id", "is not", null)
    .groupBy("category")
    .execute();
  return rows.map((r) => ({ category: r.category, products: Number(r.products) }));
}
