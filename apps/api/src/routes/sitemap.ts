/**
 * @module sitemap
 *
 * @remarks
 * Expone los slugs públicos del catálogo para que `apps/web` construya su
 * `sitemap.xml`. El API hace las queries a Supabase (web nunca accede directo)
 * y devuelve sólo slugs — `web` arma los `<loc>` con su propio host.
 *
 * No incluye `<lastmod>`: el dato de "última modificación" relevante de un
 * producto es el precio, que vive en otra tabla y cambia seguido; un lastmod
 * basado en `products.updated_at` sería engañoso. Mejor omitirlo.
 */
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { CACHE_TTL, Cache } from "@/middleware/cache";
import { Limit } from "@/middleware/rate-limit";

const sitemap = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type SupabaseClient = ReturnType<typeof createSupabase>;

// PostgREST limita a 1000 filas por request. Sólo `api_products` puede
// superarlo en prod; categorías y tiendas caben de sobra en una página.
const PAGE_SIZE = 1000;

/** Slugs de productos con al menos un listing activo (los demás dan 404). */
async function productSlugs(supabase: SupabaseClient): Promise<string[]> {
  const slugs: string[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("api_products")
      .select("slug")
      .gt("listings_count", 0)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`sitemap products query failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.slug) slugs.push(row.slug);
    }
    if (data.length < PAGE_SIZE) break;
  }
  return slugs;
}

// GET /v1/sitemap — slugs públicos del catálogo (productos con listings,
// categorías y tiendas). Cacheado 1h: el costo de paginación se amortiza.
sitemap.get("/", Cache({ mode: "public", ttl: CACHE_TTL.LONG, name: "sitemap" }), Limit("lenient"), async (c) => {
  const supabase = createSupabase(c.env);

  try {
    const [products, categories, stores] = await Promise.all([
      productSlugs(supabase),
      supabase.from("categories").select("slug"),
      supabase.from("stores").select("slug"),
    ]);

    if (categories.error) throw new Error(`sitemap categories query failed: ${categories.error.message}`);
    if (stores.error) throw new Error(`sitemap stores query failed: ${stores.error.message}`);

    return c.json({
      products,
      categories: (categories.data ?? []).map((r) => r.slug).filter((s): s is string => Boolean(s)),
      stores: (stores.data ?? []).map((r) => r.slug).filter((s): s is string => Boolean(s)),
    });
  } catch (error) {
    console.error("sitemap generation failed:", error);
    return c.json({ error: "Failed to build sitemap" }, 500);
  }
});

export default sitemap;
