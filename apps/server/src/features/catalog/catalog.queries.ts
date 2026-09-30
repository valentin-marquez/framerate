import type {
  BrandCount,
  Category,
  Offer,
  PricePoint,
  PriceRange,
  ProductDetail,
  ProductListQuery,
  ProductPage,
  ProductSummary,
  Sitemap,
} from "@framerate/contracts";
import { CATEGORY_SLUGS } from "@framerate/contracts";
import { type Db, parseJson, toBool } from "@framerate/database";
import { slugify } from "@framerate/kit";
import { titleTokens } from "@framerate/matching";
import { sql } from "kysely";
import { likePattern } from "@/shared/sql";

/**
 * Consultas de lectura del catálogo público. Las listas (catálogo, búsqueda, marcas, rangos, conteos) sólo
 * muestran productos con al menos una oferta activa CON STOCK. La ficha y el sitemap no filtran por stock:
 * el producto sigue accesible por enlace y para SEO.
 */

/** Convierte texto libre en una consulta FTS5 segura: cada palabra como prefijo literal. */
export function ftsQuery(q: string): string | null {
  const tokens = titleTokens(q).slice(0, 8);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

/** Agregado por producto sobre ofertas visibles (activas y con stock). */
function offerAggregate(db: Db) {
  return db.query
    .selectFrom("listings")
    .select((eb) => [
      "product_id",
      eb.fn.min("price_cash").as("best_price"),
      eb.fn.countAll<number>().as("offer_count"),
    ])
    .where("is_active", "=", 1)
    .where("in_stock", "=", 1)
    .where("product_id", "is not", null)
    .groupBy("product_id")
    .as("agg");
}

const mpnOf = sql<
  string | null
>`(select value from product_identifiers pi where pi.product_id = p.id and pi.kind = 'mpn' limit 1)`;

/** Vistas de los últimos 7 días (popularidad). */
const views7d = sql<number>`coalesce((select sum(v.views) from product_views_daily v where v.product_id = p.id and v.day >= ${daysAgoDate(7)}), 0)`;

function daysAgoDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Marca (nombre canónico) a partir de su slug dentro de una categoría; si no coincide ninguna, el texto tal cual. */
async function resolveBrand(db: Db, brand: string, category?: string): Promise<string> {
  let query = db.query.selectFrom("products").select("brand").distinct().where("brand", "is not", null);
  if (category) query = query.where("category", "=", category);
  const names = (await query.execute()).map((r) => r.brand as string);
  return names.find((name) => slugify(name) === slugify(brand)) ?? brand;
}

export async function listProducts(db: Db, query: ProductListQuery): Promise<ProductPage> {
  let match: string | null = null;
  if (query.q) {
    match = ftsQuery(query.q);
    if (!match) return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
  }
  const brand = query.brand ? await resolveBrand(db, query.brand, query.category) : null;

  let base = db.query.selectFrom("products as p").innerJoin(offerAggregate(db), "agg.product_id", "p.id");
  if (query.category) base = base.where("p.category", "=", query.category);
  if (brand) base = base.where(sql<boolean>`lower(p.brand) = lower(${brand})`);
  if (query.store) {
    base = base.where(
      sql<boolean>`p.id IN (SELECT l.product_id FROM listings l JOIN stores st ON st.id = l.store_id WHERE l.is_active = 1 AND l.in_stock = 1 AND st.slug = ${query.store})`,
    );
  }
  if (query.minPrice !== undefined) base = base.where("agg.best_price", ">=", query.minPrice);
  if (query.maxPrice !== undefined) base = base.where("agg.best_price", "<=", query.maxPrice);
  if (match)
    base = base.where(sql<boolean>`p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ${match})`);

  let page = base.select([
    "p.id",
    "p.slug",
    "p.name",
    "p.brand",
    "p.category",
    "p.image_url as imageUrl",
    "p.attributes",
    "agg.best_price as bestPrice",
    // ponytail: igual a bestPrice desde que las listas sólo muestran stock; se quita del contrato al migrar la web.
    "agg.best_price as lowestPrice",
    "agg.offer_count as offerCount",
    mpnOf.as("mpn"),
  ]);
  switch (query.sort) {
    case "relevance":
      page = page.orderBy("agg.offer_count", "desc").orderBy("agg.best_price").orderBy("p.name");
      break;
    case "price_asc":
      page = page.orderBy("agg.best_price").orderBy("p.name");
      break;
    case "price_desc":
      page = page.orderBy("agg.best_price", "desc").orderBy("p.name");
      break;
    case "newest":
      page = page.orderBy("p.created_at", "desc").orderBy("p.id");
      break;
    case "popularity":
      page = page.orderBy(views7d, "desc").orderBy("agg.offer_count", "desc").orderBy("p.name");
      break;
    case "name":
      page = page.orderBy("p.name");
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
    items: rows.map((r) => ({
      ...r,
      category: r.category as Category,
      attributes: parseJson<ProductSummary["attributes"]>(r.attributes, {}),
      offerCount: Number(r.offerCount),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: Number(totalRow?.total ?? 0),
  };
}

export async function getProduct(db: Db, slug: string): Promise<ProductDetail | null> {
  const product = await db.query
    .selectFrom("products as p")
    .selectAll("p")
    .select(mpnOf.as("mpn"))
    .where("p.slug", "=", slug)
    .executeTakeFirst();
  if (!product) return null;

  const offerRows = await db.query
    .selectFrom("listings as l")
    .innerJoin("stores as s", "s.id", "l.store_id")
    .select([
      "l.id",
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
      id: o.id,
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
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category as Category,
    imageUrl: product.image_url,
    bestPrice: inStock.length > 0 ? Math.min(...inStock.map((o) => o.priceCash)) : null,
    lowestPrice: offers.length > 0 ? Math.min(...offers.map((o) => o.priceCash)) : null,
    mpn: product.mpn,
    attributes: parseJson<ProductSummary["attributes"]>(product.attributes, {}),
    offerCount: offers.length,
  };
  return { ...summary, offers };
}

export async function getPriceHistory(db: Db, slug: string, days: number): Promise<PricePoint[] | null> {
  const product = await db.query.selectFrom("products").select("id").where("slug", "=", slug).executeTakeFirst();
  if (!product) return null;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await db.query
    .selectFrom("price_points as pp")
    .innerJoin("listings as l", "l.id", "pp.listing_id")
    .innerJoin("stores as s", "s.id", "l.store_id")
    .select([
      "s.slug as store",
      "s.name as storeName",
      "pp.price_cash",
      "pp.price_card",
      "pp.in_stock",
      "pp.observed_at",
    ])
    .where("l.product_id", "=", product.id)
    .where("pp.observed_at", ">=", since)
    .orderBy("pp.observed_at")
    .orderBy("pp.id")
    .execute();
  return rows.map((r) => ({
    store: r.store,
    storeName: r.storeName,
    priceCash: r.price_cash,
    priceCard: r.price_card,
    inStock: toBool(r.in_stock),
    observedAt: r.observed_at,
  }));
}

export async function listStores(db: Db, q?: string) {
  let query = db.query
    .selectFrom("stores as s")
    .leftJoin("store_profiles as p", "p.store_id", "s.id")
    .leftJoin("listings as l", (join) => join.onRef("l.store_id", "=", "s.id").on("l.is_active", "=", 1))
    .select((eb) => [
      "s.slug",
      "s.name",
      "s.url",
      "s.domain",
      "s.scraped_icon_url as iconUrl",
      "s.organization_id",
      eb.fn.count<number>("l.id").as("offerCount"),
    ])
    .where("s.is_active", "=", 1);
  if (q) {
    const pattern = likePattern(q);
    query = query.where(
      sql<boolean>`(s.name LIKE ${pattern} ESCAPE '\\' OR s.domain LIKE ${pattern} ESCAPE '\\' OR p.display_name LIKE ${pattern} ESCAPE '\\')`,
    );
  }
  const rows = await query.groupBy("s.id").orderBy("s.name").execute();
  return rows.map(({ organization_id, ...r }) => ({
    ...r,
    isClaimed: organization_id !== null,
    offerCount: Number(r.offerCount),
  }));
}

export async function categoryCounts(db: Db) {
  const rows = await db.query
    .selectFrom("listings")
    .select(["category", sql<number>`count(distinct product_id)`.as("products")])
    .where("is_active", "=", 1)
    .where("in_stock", "=", 1)
    .where("product_id", "is not", null)
    .groupBy("category")
    .execute();
  return rows.map((r) => ({ category: r.category, products: Number(r.products) }));
}

/** Marcas con productos activos en una categoría, con su conteo. */
export async function listBrands(db: Db, category: Category): Promise<BrandCount[]> {
  const rows = await db.query
    .selectFrom("products as p")
    .innerJoin(offerAggregate(db), "agg.product_id", "p.id")
    .select(["p.brand", (eb) => eb.fn.countAll<number>().as("count")])
    .where("p.category", "=", category)
    .where("p.brand", "is not", null)
    .groupBy("p.brand")
    .orderBy("count", "desc")
    .orderBy("p.brand")
    .execute();
  return rows.map((r) => ({ name: r.brand as string, slug: slugify(r.brand as string), count: Number(r.count) }));
}

export async function priceRange(db: Db, category: Category): Promise<PriceRange> {
  const row = await db.query
    .selectFrom("products as p")
    .innerJoin(offerAggregate(db), "agg.product_id", "p.id")
    .select((eb) => [eb.fn.min("agg.best_price").as("min"), eb.fn.max("agg.best_price").as("max")])
    .where("p.category", "=", category)
    .executeTakeFirst();
  return { min: row?.min ?? null, max: row?.max ?? null };
}

/** Slug vigente de un producto que cambió de nombre o se fusionó. */
export async function resolveRedirect(db: Db, oldSlug: string): Promise<string | null> {
  const row = await db.query
    .selectFrom("product_slug_redirects as r")
    .innerJoin("products as p", "p.id", "r.product_id")
    .select("p.slug")
    .where("r.old_slug", "=", oldSlug)
    .executeTakeFirst();
  return row?.slug ?? null;
}

/** Suma una vista del día al producto. Devuelve false si no existe. */
export async function trackView(db: Db, slug: string): Promise<boolean> {
  const product = await db.query.selectFrom("products").select("id").where("slug", "=", slug).executeTakeFirst();
  if (!product) return false;
  await db.query
    .insertInto("product_views_daily")
    .values({ product_id: product.id, day: daysAgoDate(0), views: 1 })
    .onConflict((oc) => oc.columns(["product_id", "day"]).doUpdateSet({ views: sql`views + 1` }))
    .execute();
  return true;
}

export async function sitemap(db: Db): Promise<Sitemap> {
  const [products, counts, stores] = await Promise.all([
    db.query
      .selectFrom("products as p")
      .select("p.slug")
      .where(sql<boolean>`exists (select 1 from listings l where l.product_id = p.id and l.is_active = 1)`)
      .orderBy("p.slug")
      .execute(),
    categoryCounts(db),
    db.query.selectFrom("stores").select("slug").where("is_active", "=", 1).orderBy("slug").execute(),
  ]);
  const withProducts = new Set(counts.filter((c) => c.products > 0).map((c) => c.category));
  return {
    products: products.map((p) => p.slug),
    categories: Object.entries(CATEGORY_SLUGS)
      .filter(([category]) => withProducts.has(category))
      .map(([, slug]) => slug),
    stores: stores.map((s) => s.slug),
  };
}
