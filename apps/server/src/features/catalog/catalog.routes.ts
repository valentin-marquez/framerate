import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  categoryFromSlug,
  ProductListQuerySchema,
} from "@framerate/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { AppError } from "@/shared/http/errors";
import { edgeCache } from "@/shared/http/middleware";
import {
  categoryCounts,
  getPriceHistory,
  getProduct,
  listBrands,
  listProducts,
  listStores,
  priceRange,
  resolveRedirect,
  sitemap,
  trackView,
} from "./catalog.queries";

function categoryParam(slug: string | undefined) {
  const category = categoryFromSlug(slug ?? "");
  if (!category) throw new AppError(404, "category_not_found", "Categoría no encontrada");
  return category;
}

/** API pública de lectura (montada bajo `/v1`). */
export const catalogRoutes = new Hono<AppEnv>()
  .get("/categories", edgeCache(3600), async (c) => {
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
  .get("/categories/:slug/brands", edgeCache(3600), async (c) => {
    return c.json({ items: await listBrands(c.var.db, categoryParam(c.req.param("slug"))) });
  })
  .get("/categories/:slug/price-range", edgeCache(3600), async (c) => {
    return c.json(await priceRange(c.var.db, categoryParam(c.req.param("slug"))));
  })
  .get("/stores", edgeCache(60), async (c) =>
    c.json({ items: await listStores(c.var.db, c.req.query("q")?.trim() || undefined) }),
  )
  .get("/sitemap", edgeCache(3600), async (c) => c.json(await sitemap(c.var.db)))
  .get("/products", edgeCache(300), async (c) => {
    const query = ProductListQuerySchema.parse(c.req.query());
    return c.json(await listProducts(c.var.db, query));
  })
  .get("/products/redirects/:slug", edgeCache(3600), async (c) => {
    const slug = await resolveRedirect(c.var.db, c.req.param("slug"));
    if (!slug) throw new AppError(404, "redirect_not_found", "Sin redirección");
    return c.json({ slug });
  })
  .get("/products/:slug", edgeCache(300), async (c) => {
    const product = await getProduct(c.var.db, c.req.param("slug"));
    if (!product) throw new AppError(404, "product_not_found", "Producto no encontrado");
    return c.json(product);
  })
  .get("/products/:slug/price-history", edgeCache(1800), async (c) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(365).default(90) }).parse(c.req.query());
    const points = await getPriceHistory(c.var.db, c.req.param("slug"), days);
    if (!points) throw new AppError(404, "product_not_found", "Producto no encontrado");
    return c.json({ items: points });
  })
  .post("/products/:slug/view", async (c) => {
    if (!(await trackView(c.var.db, c.req.param("slug")))) {
      throw new AppError(404, "product_not_found", "Producto no encontrado");
    }
    return c.body(null, 204);
  });
