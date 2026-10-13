import type {
  BrandCount,
  Category,
  FacetList,
  Offer,
  PricePoint,
  PriceRange,
  ProductDetail,
  ProductListQuery,
  ProductPage,
  ProductSummary,
  ProductVariant,
  Sitemap,
} from "@framerate/contracts";
import { CATEGORY_FACETS, CATEGORY_SLUGS, facetValueLabel } from "@framerate/contracts";
import { type Db, parseJson, toBool } from "@framerate/database";
import { searchText, slugify } from "@framerate/kit";
import { normalizeGtin, normalizeMpn, titleTokens } from "@framerate/matching";
import { type RawBuilder, sql } from "kysely";
import { likePattern } from "@/shared/sql";
import { fuseSpecs } from "./product-specs";

/**
 * Consultas de lectura del catálogo público. Las listas (catálogo, búsqueda, marcas, rangos, conteos) sólo
 * muestran productos con al menos una oferta activa CON STOCK y visible. La ficha y el sitemap no filtran por
 * stock (el producto sigue accesible por enlace y para SEO), pero sí exigen una oferta visible.
 */

/**
 * Convierte texto libre en una consulta FTS5 segura: cada palabra como prefijo literal. Se normaliza con
 * `searchText`, igual que la columna `search` del índice, para que `5070ti` y `5070 ti` encuentren lo mismo (#129).
 */
export function ftsQuery(q: string): string | null {
  const tokens = [...new Set(titleTokens(q).flatMap((t) => searchText(t).split(" ")))]
    .filter((t) => t.length > 1)
    .slice(0, 8);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

/**
 * Una oferta con revisión de matching pendiente no se lista: el matching dudó y le creó un producto propio que puede ser
 * un duplicado. Sigue en su ficha (que no filtra) y vuelve a las listas cuando la revisión se resuelve.
 */
const notUnderReview = sql<boolean>`id NOT IN (SELECT listing_id FROM match_reviews WHERE status = 'pending')`;

/**
 * Agregado por producto sobre ofertas publicadas: activas, con stock, sin revisión pendiente y `visible = 1` (una
 * oferta nueva nace oculta hasta pasar el pipeline de normalización, #153 §8; las de antes ya son visibles).
 */
function offerAggregate(db: Db) {
  return db.query
    .selectFrom("listings")
    .select((eb) => [
      "product_id",
      eb.fn.min("price_cash").as("best_price"),
      eb.fn.min("price_card").as("best_card_price"),
      eb.fn.countAll<number>().as("offer_count"),
    ])
    .where("is_active", "=", 1)
    .where("in_stock", "=", 1)
    .where("visible", "=", 1)
    .where("product_id", "is not", null)
    .where(notUnderReview)
    .groupBy("product_id")
    .as("agg");
}

const mpnOf = sql<
  string | null
>`(select value from product_identifiers pi where pi.product_id = p.id and pi.kind = 'mpn' limit 1)`;

function _daysAgoDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Marcas (nombre canónico) a partir de sus slugs dentro de una categoría; la que no coincide con ninguna, el texto tal cual. */
async function resolveBrands(db: Db, brands: string[], category?: string): Promise<string[]> {
  let query = db.query.selectFrom("products").select("brand").distinct().where("brand", "is not", null);
  if (category) query = query.where("category", "=", category);
  const names = (await query.execute()).map((r) => r.brand as string);
  return brands.map((brand) => names.find((name) => slugify(name) === slugify(brand)) ?? brand);
}

/** Foto del producto: la copia propia en R2 (`image_key`, ya achicada por ingest), o la URL de la tienda mientras no exista. */
export function productImageUrl(
  product: { image_key: string | null; image_url: string | null },
  assetsBaseUrl: string | undefined,
): string | null {
  if (!product.image_key || !assetsBaseUrl) return product.image_url;
  return `${assetsBaseUrl.replace(/\/+$/, "")}/${product.image_key}`;
}

/** Filtros del listado que también acotan las facetas. */
type ListFilters = Pick<
  ProductListQuery,
  "category" | "brand" | "store" | "q" | "minPrice" | "maxPrice" | "spec" | "deals"
>;

/**
 * Valor JSON como texto comparable con `spec=clave:valor`: booleanos 'true'/'false' (`json_extract` da 1/0), enteros
 * sin decimales y strings tal cual (o, con `clean`, en mayúsculas y sin espacios: "LGA 1700", "LGA-1700", "FCLGA1700" y "lga1700"
 * de distintas tiendas son "LGA1700"). NULL si no está el dato.
 */
function jsonText(doc: RawBuilder<unknown>, path: string, clean = false) {
  const value = sql`json_extract(${doc}, ${path})`;
  const text = clean ? sql`upper(replace(replace(replace(${value}, ' ', ''), '-', ''), 'FCLGA', 'LGA'))` : value;
  return sql<string | null>`(CASE json_type(${doc}, ${path})
    WHEN 'true' THEN 'true' WHEN 'false' THEN 'false'
    WHEN 'integer' THEN CAST(${value} AS TEXT)
    WHEN 'real' THEN CASE WHEN ${value} = CAST(${value} AS INTEGER)
      THEN CAST(CAST(${value} AS INTEGER) AS TEXT) ELSE CAST(${value} AS TEXT) END
    WHEN 'text' THEN ${text} END)`;
}

const SPEC_SOURCED = new Set(
  Object.values(CATEGORY_FACETS)
    .flat()
    .filter((f) => f.source === "specs")
    .map((f) => f.key),
);

/**
 * Valor de una faceta para el producto `p`. Las de `attributes` salen de la columna; las de specs, del valor de origen
 * `text` que más repiten sus ofertas activas (la misma fusión que la ficha, sin `knowledge`).
 * ponytail: subconsulta por producto sobre `listing_identity`; cuando `products.specs` se llene fundido (#153 fase 4),
 * leer de ahí como `attributes`.
 */
function specValue(key: string) {
  const path = `$.${key}`;
  if (key === "chipMaker") {
    const chipset = sql`json_extract(p.attributes, '$.chipset')`;
    return sql<
      string | null
    >`(CASE WHEN ${chipset} LIKE 'rtx %' OR ${chipset} LIKE 'gtx %' OR ${chipset} LIKE 'gt %' THEN 'nvidia'
      WHEN ${chipset} LIKE 'rx %' THEN 'amd' WHEN ${chipset} LIKE 'arc %' THEN 'intel' END)`;
  }
  if (!SPEC_SOURCED.has(key)) return jsonText(sql`p.attributes`, path);
  const raw = jsonText(sql`i.specs`, path, true);
  // Hay tiendas que escriben el socket Intel sólo con el número (1700).
  const value =
    key === "socket" ? sql`(CASE WHEN ${raw} GLOB '[0-9][0-9][0-9][0-9]' THEN 'LGA' || ${raw} ELSE ${raw} END)` : raw;
  return sql<string | null>`(SELECT ${value} FROM listings l JOIN listing_identity i ON i.listing_id = l.id
    WHERE l.product_id = p.id AND l.is_active = 1 AND json_extract(i.specs_source, ${path}) = 'text'
      AND i.version = (SELECT max(x.version) FROM listing_identity x WHERE x.listing_id = l.id)
      AND ${value} IS NOT NULL
    GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1)`;
}

/** Valores pedidos por clave: OR dentro de una clave, AND entre claves. */
function specGroups(spec: ListFilters["spec"]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const { key, value } of spec ?? []) groups.set(key, [...(groups.get(key) ?? []), value]);
  return groups;
}

/**
 * Productos con stock (join con `offerAggregate`) que pasan los filtros. `skipSpecKey` deja fuera el filtro de esa
 * faceta (sus conteos). Un producto sin el dato de una clave filtrada no se excluye: queda "unknown".
 */
async function filteredProducts(db: Db, filters: ListFilters) {
  let match: string | null = null;
  if (filters.q) {
    match = ftsQuery(filters.q);
    if (!match) return null;
  }
  const brand = filters.brand?.length ? await resolveBrands(db, filters.brand, filters.category) : null;
  return (skipSpecKey?: string) => filteredQuery(db, filters, brand, match, skipSpecKey);
}

function filteredQuery(
  db: Db,
  filters: ListFilters,
  brand: string[] | null,
  match: string | null,
  skipSpecKey?: string,
) {
  let base = db.query.selectFrom("products as p").innerJoin(offerAggregate(db), "agg.product_id", "p.id");
  if (filters.category) base = base.where("p.category", "=", filters.category);
  if (brand) base = base.where(sql<boolean>`lower(p.brand) IN (${sql.join(brand.map((b) => sql`lower(${b})`))})`);
  if (filters.store) {
    base = base.where(
      sql<boolean>`p.id IN (SELECT l.product_id FROM listings l JOIN stores st ON st.id = l.store_id WHERE l.is_active = 1 AND l.in_stock = 1 AND l.visible = 1 AND st.slug = ${filters.store})`,
    );
  }
  if (filters.minPrice !== undefined) base = base.where("agg.best_price", ">=", filters.minPrice);
  if (filters.maxPrice !== undefined) base = base.where("agg.best_price", "<=", filters.maxPrice);
  if (match)
    base = base.where(sql<boolean>`p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ${match})`);
  // Baja de al menos 3 % bajo el precio habitual, en enteros para no depender de flotantes.
  if (filters.deals)
    base = base.where(sql<boolean>`p.reference_price IS NOT NULL AND agg.best_price * 100 <= p.reference_price * 97`);

  const unknown: ReturnType<typeof specValue>[] = [];
  for (const [key, values] of specGroups(filters.spec)) {
    if (key === skipSpecKey) continue;
    const value = specValue(key);
    base = base.where(sql<boolean>`(${value} IS NULL OR ${value} IN (${sql.join(values)}))`);
    unknown.push(value);
  }
  const isUnknown =
    unknown.length > 0
      ? sql<number>`(${sql.join(
          unknown.map((v) => sql`${v} IS NULL`),
          sql` OR `,
        )})`
      : null;
  return { base, isUnknown };
}

export async function listProducts(
  db: Db,
  query: ProductListQuery,
  assetsBaseUrl: string | undefined,
): Promise<ProductPage> {
  const build = await filteredProducts(db, query);
  if (!build) return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
  const { base, isUnknown } = build();

  let page = base.select([
    "p.id",
    "p.slug",
    "p.name",
    "p.brand",
    "p.category",
    "p.image_url",
    "p.image_key",
    "p.attributes",
    "p.reference_price as referencePrice",
    "agg.best_price as bestPrice",
    "agg.best_card_price as bestCardPrice",
    "agg.offer_count as offerCount",
    mpnOf.as("mpn"),
    (isUnknown ?? sql<number>`0`).as("unknown"),
  ]);
  // Los que cumplen con el dato conocido antes que los que no lo tienen; dentro de cada grupo, el orden pedido.
  if (isUnknown) page = page.orderBy(isUnknown);
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
      page = page.orderBy("p.views_7d", "desc").orderBy("agg.offer_count", "desc").orderBy("p.name");
      break;
    case "name":
      page = page.orderBy("p.name");
      break;
    case "discount":
      // En SQLite NULL es el menor valor: en DESC los sin referencia quedan al final.
      page = page.orderBy(sql`p.reference_price - agg.best_price`, "desc").orderBy("p.name");
      break;
  }

  const [rows, [totalRow]] = await db.read([
    page.limit(query.pageSize).offset((query.page - 1) * query.pageSize),
    base.select((eb) => [
      eb.fn.countAll<number>().as("total"),
      sql<number>`coalesce(sum(${isUnknown ?? sql`0`}), 0)`.as("unknown"),
    ]),
  ]);

  return {
    items: rows.map(({ image_url, image_key, unknown, ...r }) => ({
      ...r,
      imageUrl: productImageUrl({ image_url, image_key }, assetsBaseUrl),
      category: r.category as Category,
      attributes: parseJson<ProductSummary["attributes"]>(r.attributes, {}),
      offerCount: Number(r.offerCount),
      ...(isUnknown && { specMatch: Number(unknown) ? ("unknown" as const) : ("match" as const) }),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: Number(totalRow?.total ?? 0),
    ...(isUnknown && { specUnknown: Number(totalRow?.unknown ?? 0) }),
  };
}

/**
 * Valores de cada faceta de la categoría con su conteo (sólo con stock). Cada faceta aplica todos los filtros menos
 * el suyo, para poder sumar valores de la misma faceta. Una consulta por faceta, en un solo viaje.
 */
export async function listFacets(db: Db, category: Category, filters: ListFilters): Promise<FacetList> {
  const facets = CATEGORY_FACETS[category];
  const build = await filteredProducts(db, { ...filters, category });
  const queries = build
    ? facets.map((facet) => {
        const value = specValue(facet.key);
        return build(facet.key)
          .base.select([value.as("value"), (eb) => eb.fn.countAll<number>().as("count")])
          .groupBy(value);
      })
    : [];
  const results = queries.length > 0 ? await db.read(queries) : [];
  return {
    items: facets.map((facet, i) => {
      const rows = results[i] ?? [];
      const values = rows
        .filter((r): r is { value: string; count: number } => r.value !== null && Number(r.count) > 0)
        .map((r) => ({ value: r.value, label: facetValueLabel(facet, r.value), count: Number(r.count) }));
      values.sort((a, b) =>
        facet.unit ? Number(a.value) - Number(b.value) : b.count - a.count || a.value.localeCompare(b.value, "es"),
      );
      return {
        key: facet.key,
        label: facet.label,
        values,
        unknownCount: Number(rows.find((r) => r.value === null)?.count ?? 0),
      };
    }),
  };
}

export async function getProduct(
  db: Db,
  slug: string,
  assetsBaseUrl: string | undefined,
): Promise<ProductDetail | null> {
  const [[product], offerRows, specRows] = await db.read([
    db.query.selectFrom("products as p").selectAll("p").select(mpnOf.as("mpn")).where("p.slug", "=", slug),
    db.query
      .selectFrom("listings as l")
      .innerJoin("products as pr", "pr.id", "l.product_id")
      .innerJoin("stores as s", "s.id", "l.store_id")
      .select([
        "l.id",
        "s.slug as storeSlug",
        "s.name as storeName",
        "s.url as storeUrl",
        "s.scraped_icon_url as storeIconUrl",
        "l.url",
        "l.title",
        "l.price_cash",
        "l.price_card",
        "l.in_stock",
        "l.stock_quantity",
        "l.last_seen_at",
        "l.is_active",
      ])
      .where("pr.slug", "=", slug)
      .where("l.visible", "=", 1)
      .orderBy("l.in_stock", "desc")
      .orderBy("l.price_cash"),
    // La última identidad de cada oferta: al subir `NORMALIZER_VERSION` las specs siguen a la vista mientras se
    // vuelve a normalizar.
    db.query
      .selectFrom("listing_identity as i")
      .innerJoin("listings as l", "l.id", "i.listing_id")
      .innerJoin("products as pr", "pr.id", "l.product_id")
      .select(["i.specs", "i.specs_source"])
      .where("pr.slug", "=", slug)
      .where("l.is_active", "=", 1)
      .where(
        "i.version",
        "=",
        sql<number>`(SELECT max(x.version) FROM listing_identity x WHERE x.listing_id = i.listing_id)`,
      ),
  ]);
  if (!product) return null;

  // Un producto cuyas ofertas están todas ocultas (nuevo a medio procesar en el pipeline) no existe públicamente
  // todavía. Uno sin ninguna oferta sí: conserva su URL (#144).
  if (offerRows.length === 0 && (await onlyHiddenOffers(db, product.id))) return null;

  const offers: Offer[] = offerRows
    .filter((o) => toBool(o.is_active))
    .map((o) => ({
      id: o.id,
      store: { slug: o.storeSlug, name: o.storeName, url: o.storeUrl, iconUrl: o.storeIconUrl },
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
    imageUrl: productImageUrl(product, assetsBaseUrl),
    bestPrice: inStock.length > 0 ? Math.min(...inStock.map((o) => o.priceCash)) : null,
    bestCardPrice: inStock.length > 0 ? Math.min(...inStock.map((o) => o.priceCard)) : null,
    mpn: product.mpn,
    attributes: parseJson<ProductSummary["attributes"]>(product.attributes, {}),
    // Tiendas, no publicaciones: una tienda puede publicar el mismo producto dos veces.
    offerCount: new Set(offers.map((o) => o.store.slug)).size,
    referencePrice: product.reference_price,
  };
  const family = await productFamily(db, product.id, product.family_key, assetsBaseUrl);
  return { ...summary, offers, specs: fuseSpecs(summary.category, specRows), ...family };
}

const FAMILY_SHOWN = 8;

/** Los demás productos de la familia (#101): publicados y con ofertas, con stock primero y luego por precio. */
async function productFamily(
  db: Db,
  productId: number,
  familyKey: string | null,
  assetsBaseUrl: string | undefined,
): Promise<{ variants: ProductVariant[]; variantsTotal: number }> {
  if (!familyKey) return { variants: [], variantsTotal: 0 };
  const rows = await db.query
    .selectFrom("products")
    .select(["slug", "name", "best_price", "in_stock_offer_count", "image_url", "image_key"])
    .where("family_key", "=", familyKey)
    .where("id", "!=", productId)
    .where("published_at", "is not", null)
    .where("offer_count", ">", 0)
    .orderBy(sql`in_stock_offer_count > 0`, "desc")
    .orderBy("best_price")
    .execute();
  return {
    variants: rows.slice(0, FAMILY_SHOWN).map((r) => ({
      slug: r.slug,
      name: r.name,
      imageUrl: productImageUrl(r, assetsBaseUrl),
      bestPrice: r.in_stock_offer_count > 0 ? r.best_price : null,
    })),
    variantsTotal: rows.length,
  };
}

export async function getPriceHistory(db: Db, slug: string, days: number): Promise<PricePoint[] | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [[product], rows] = await db.read([
    db.query.selectFrom("products").select("id").where("slug", "=", slug),
    db.query
      .selectFrom("price_points as pp")
      .innerJoin("listings as l", "l.id", "pp.listing_id")
      .innerJoin("products as pr", "pr.id", "l.product_id")
      .innerJoin("stores as s", "s.id", "l.store_id")
      .select([
        "s.slug as store",
        "s.name as storeName",
        "pp.price_cash",
        "pp.price_card",
        "pp.in_stock",
        "pp.observed_at",
      ])
      .where("pr.slug", "=", slug)
      .where("pp.observed_at", ">=", since)
      .orderBy("pp.observed_at")
      .orderBy("pp.id"),
  ]);
  if (!product) return null;
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

/** Fin de la última corrida de ingesta exitosa (de cualquier tienda): cuándo se actualizaron las ofertas. */
export async function lastCrawlAt(db: Db) {
  const row = await db.query
    .selectFrom("crawl_runs")
    .select(sql<string | null>`max(finished_at)`.as("at"))
    .where("status", "=", "succeeded")
    .executeTakeFirst();
  return row?.at ?? null;
}

export async function categoryCounts(db: Db) {
  const rows = await db.query
    .selectFrom("listings")
    .select(["category", sql<number>`count(distinct product_id)`.as("products")])
    .where("is_active", "=", 1)
    .where("in_stock", "=", 1)
    .where("visible", "=", 1)
    .where("product_id", "is not", null)
    .where(notUnderReview)
    .groupBy("category")
    .execute();
  return rows.map((r) => ({ category: r.category, products: Number(r.products) }));
}

/** Marcas con productos activos en una categoría, con su conteo. */
/**
 * Marcas con productos con stock en una categoría, con su conteo. Acepta los filtros del listado (texto, precio,
 * spec, ofertas) salvo la propia marca, como las facetas: así /cyber cuenta sólo las bajas.
 */
export async function listBrands(db: Db, category: Category, filters: ListFilters = {}): Promise<BrandCount[]> {
  const build = await filteredProducts(db, { ...filters, brand: undefined, category });
  if (!build) return [];
  const rows = await build()
    .base.select(["p.brand", (eb) => eb.fn.countAll<number>().as("count")])
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

/** Slug vigente de un producto que cambió de nombre, se fusionó o viene del sistema anterior. */
export async function resolveRedirect(db: Db, oldSlug: string): Promise<string | null> {
  const row = await db.query
    .selectFrom("product_slug_redirects as r")
    .innerJoin("products as p", "p.id", "r.product_id")
    .select("p.slug")
    .where("r.old_slug", "=", oldSlug)
    .executeTakeFirst();
  return row?.slug ?? (await resolveLegacySlug(db, oldSlug));
}

/**
 * Las fichas del sistema anterior cerraban en un id de 13 dígitos con uno o dos guiones, y justo antes llevaban el
 * MPN o el GTIN (`asus-prime-b550m-a-ac-90mb15k0-mvaay0-1782355372370`, #145). Se prueba el slug sin sufijo y después
 * los últimos 1 a 4 tramos como identificador, del más largo al más corto; sólo vale si apunta a un único producto.
 */
async function resolveLegacySlug(db: Db, slug: string): Promise<string | null> {
  const base = slug.match(/^(.+?)--?\d{13}$/)?.[1];
  if (!base) return null;
  const same = await db.query.selectFrom("products").select("slug").where("slug", "=", base).executeTakeFirst();
  if (same) return same.slug;

  const parts = base.split("-");
  const codes = [4, 3, 2, 1].flatMap((n) => {
    const raw = parts.slice(-n).join("");
    return n <= parts.length ? [normalizeMpn(raw), normalizeGtin(raw)].filter((c): c is string => c !== null) : [];
  });
  if (codes.length === 0) return null;
  const rows = await db.query
    .selectFrom("product_identifiers as i")
    .innerJoin("products as p", "p.id", "i.product_id")
    .select(["i.value", "p.id", "p.slug"])
    .where("i.value", "in", codes)
    .execute();
  for (const code of codes) {
    const products = new Map(rows.filter((r) => r.value === code).map((r) => [r.id, r.slug]));
    if (products.size > 0) return products.size === 1 ? ([...products.values()][0] ?? null) : null;
  }
  return null;
}

/** El producto `p` tiene ofertas y todas están ocultas por el pipeline (#153). */
const HIDDEN_ONLY = sql`exists (select 1 from listings l where l.product_id = p.id and l.visible = 0)
  and not exists (select 1 from listings l where l.product_id = p.id and l.visible = 1)`;

async function onlyHiddenOffers(db: Db, productId: number) {
  const row = await db.query
    .selectFrom("products as p")
    .select(sql<number>`${HIDDEN_ONLY}`.as("hidden"))
    .where("p.id", "=", productId)
    .executeTakeFirst();
  return Boolean(row?.hidden);
}

export async function sitemap(db: Db): Promise<Sitemap> {
  const [products, counts, stores] = await Promise.all([
    db.query
      .selectFrom("products as p")
      .select("p.slug")
      // Una ficha que perdió el stock o sus ofertas mantiene su URL y su historial (#144). Sólo falta la de un
      // producto con todas sus ofertas ocultas por el pipeline (la ficha da 404).
      .where(sql<boolean>`not (${HIDDEN_ONLY})`)
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
