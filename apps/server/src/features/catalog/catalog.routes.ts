import {
  CATEGORIES,
  CATEGORY_FACETS,
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  type Category,
  categoryFromSlug,
  nextCrawlAt,
  ProductListQuerySchema,
} from "@framerate/contracts";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { AppError } from "@/shared/http/errors";
import { catalogCache, edgeCache } from "@/shared/http/middleware";
import {
  categoryCounts,
  getPriceHistory,
  getProduct,
  lastCrawlAt,
  listBrands,
  listFacets,
  listProducts,
  listStores,
  priceRange,
  resolveRedirect,
  sitemap,
} from "./catalog.queries";

function categoryParam(slug: string | undefined) {
  const category = categoryFromSlug(slug ?? "");
  if (!category) throw new AppError(404, "category_not_found", "Categoría no encontrada");
  return category;
}

const ALL_FACET_KEYS = new Set(Object.values(CATEGORY_FACETS).flatMap((facets) => facets.map((f) => f.key)));

/**
 * Query del listado con `spec` y `brand` repetibles (`c.req.query()` se queda sólo con el primero). Con categoría, una clave
 * que no es faceta suya es un error; sin categoría, las claves que no son faceta de nadie se ignoran.
 */
function listQuery(c: Context<AppEnv>, category?: Category) {
  const query = ProductListQuerySchema.parse({
    ...c.req.query(),
    brand: c.req.queries("brand"),
    spec: c.req.queries("spec"),
    ...(category && { category }),
  });
  if (!query.spec) return query;
  if (query.category) {
    const keys = new Set(CATEGORY_FACETS[query.category].map((f) => f.key));
    const bad = query.spec.find((s) => !keys.has(s.key));
    if (bad) throw new AppError(400, "invalid_request", `spec: "${bad.key}" no es un filtro de esta categoría`);
    return query;
  }
  const spec = query.spec.filter((s) => ALL_FACET_KEYS.has(s.key));
  return { ...query, spec: spec.length > 0 ? spec : undefined };
}

/** API pública de lectura (montada bajo `/v1`). */
export const catalogRoutes = new Hono<AppEnv>()
  .get("/categories", catalogCache(3600), async (c) => {
    const counts = new Map((await categoryCounts(c.var.db)).map((r) => [r.category, r.products]));
    return c.json({
      items: CATEGORIES.map((id) => ({
        id,
        slug: CATEGORY_SLUGS[id],
        label: CATEGORY_LABELS[id],
        productCount: counts.get(id) ?? 0,
      })),
    });
  })
  .get("/categories/:slug/brands", catalogCache(300), async (c) => {
    const category = categoryParam(c.req.param("slug"));
    return c.json({ items: await listBrands(c.var.db, category, listQuery(c, category)) });
  })
  .get("/categories/:slug/price-range", catalogCache(3600), async (c) => {
    return c.json(await priceRange(c.var.db, categoryParam(c.req.param("slug"))));
  })
  // Forma 2: las facetas con umbral (#190) traen `threshold`, etiquetas "mínima" y conteos acumulados.
  .get("/categories/:slug/facets", catalogCache(300, 2), async (c) => {
    const category = categoryParam(c.req.param("slug"));
    return c.json(await listFacets(c.var.db, category, listQuery(c, category)));
  })
  .get("/stores", edgeCache(60), async (c) =>
    c.json({ items: await listStores(c.var.db, c.req.query("q")?.trim() || undefined) }),
  )
  .get("/sitemap", catalogCache(3600), async (c) => c.json(await sitemap(c.var.db)))
  .get("/freshness", edgeCache(60), async (c) => {
    const updatedAt = await lastCrawlAt(c.var.db);
    return c.json({ updatedAt, nextUpdateAt: nextCrawlAt(new Date()).toISOString() });
  })
  .get("/products", catalogCache(300), async (c) => {
    return c.json(await listProducts(c.var.db, listQuery(c), c.env.ASSETS_BASE_URL));
  })
  .get("/products/redirects/:slug", catalogCache(3600), async (c) => {
    const slug = await resolveRedirect(c.var.db, c.req.param("slug"));
    if (!slug) throw new AppError(404, "redirect_not_found", "Sin redirección");
    return c.json({ slug });
  })
  .get("/products/:slug", catalogCache(300), async (c) => {
    const product = await getProduct(c.var.db, c.req.param("slug"), c.env.ASSETS_BASE_URL);
    if (!product) throw new AppError(404, "product_not_found", "Producto no encontrado");
    return c.json(product);
  })
  .get("/products/:slug/price-history", catalogCache(1800), async (c) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(365).default(90) }).parse(c.req.query());
    const points = await getPriceHistory(c.var.db, c.req.param("slug"), days);
    if (!points) throw new AppError(404, "product_not_found", "Producto no encontrado");
    return c.json({ items: points });
  })
  .post("/products/:slug/view", async (c) => {
    // Sin validar contra D1: un slug que no existe no cruza con ningún producto al agregar `views_7d` en ingest.
    const slug = c.req.param("slug");
    // Formato de `slugify` (más el sufijo de desempate): acota la basura que puede llegar a Analytics Engine.
    if (!/^[a-z0-9-]{1,100}$/.test(slug)) throw new AppError(400, "invalid_request", "slug inválido");
    c.env.ANALYTICS?.writeDataPoint({ indexes: [slug], blobs: ["view", slug] });
    return c.body(null, 204);
  });
