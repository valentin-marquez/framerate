import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { CACHE_TTL, Cache } from "@/middleware/cache";

const products = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /products/search/quick?q=term (Live Search - optimizado)
products.get(
  "/search/quick",
  Cache({
    mode: "public",
    ttl: CACHE_TTL.QUICK_SEARCH,
    name: "quick-search",
  }),
  async (c) => {
    const supabase = createSupabase(c.env);
    const query = c.req.query("q");
    const limit = Number(c.req.query("limit")) || 10;

    if (!query || query.trim().length < 2) {
      return c.json({ data: [] });
    }

    // biome-ignore lint/suspicious/noExplicitAny: Supabase RPC sin tipos generados
    const { data, error } = await supabase.rpc("quick_search_products" as any, {
      search_term: query.trim(),
      p_limit: limit,
    });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({ data: data || [] });
  },
);

// GET /products/search?q=term
products.get(
  "/search",
  Cache({
    mode: "public",
    ttl: CACHE_TTL.SEARCH,
    name: "product-search",
  }),
  async (c) => {
    const supabase = createSupabase(c.env);
    const query = c.req.query("q");
    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;

    if (!query) {
      return c.json({ error: 'Query parameter "q" is required' }, 400);
    }

    // biome-ignore lint/suspicious/noExplicitAny: Supabase RPC sin tipos generados
    const { data, error } = await supabase.rpc("search_products" as any, {
      search_term: query,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json(data);
  },
);

// GET /products/drops
products.get(
  "/drops",
  Cache({
    mode: "public",
    ttl: CACHE_TTL.SHORT,
    name: "product-drops",
  }),
  async (c) => {
    const supabase = createSupabase(c.env);
    const limit = Number(c.req.query("limit")) || 20;
    const minDiscount = Number(c.req.query("minDiscount")) || 10;

    const { data, error } = await supabase.rpc("get_price_drops", {
      min_discount_percent: minDiscount,
      lookback_days: 30,
      limit_count: limit,
    });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json(data);
  },
);

// GET /products/:slug/price-history?days=30
// Devuelve los puntos de price_history de los listings del producto, agrupados por tienda.
products.get(
  "/:slug/price-history",
  Cache({
    mode: "public",
    ttl: CACHE_TTL.SHORT,
    name: "product-price-history",
  }),
  async (c) => {
    const supabase = createSupabase(c.env);
    const slug = c.req.param("slug");
    const days = Math.min(Math.max(Number(c.req.query("days")) || 30, 1), 365);

    const { data: product, error: productError } = await supabase
      .from("api_products")
      .select("id")
      .eq("slug", slug)
      .single();

    if (productError || !product?.id) {
      return c.json({ error: "Product not found" }, 404);
    }

    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("id, store:stores(slug, name, logo_url)")
      .eq("product_id", product.id);

    if (listingsError || !listings?.length) {
      return c.json({ days, series: [] });
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const listingIds = listings.map((l) => l.id);

    const { data: points, error: pointsError } = await supabase
      .from("price_history")
      .select("listing_id, price_cash, price_normal, recorded_at")
      .in("listing_id", listingIds)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true });

    if (pointsError) {
      return c.json({ error: pointsError.message }, 500);
    }

    // Agrupar por tienda. Un mismo store puede tener varios listings históricos
    // (por re-listado), así que mergeamos por store_slug y ordenamos.
    const byStore = new Map<
      string,
      {
        store_slug: string;
        store_name: string;
        store_logo_url: string | null;
        points: { recorded_at: string; price_cash: number; price_normal: number }[];
      }
    >();

    const listingToStore = new Map(listings.map((l) => [l.id, l.store]));

    for (const point of points || []) {
      const store = listingToStore.get(point.listing_id);
      if (!store) continue;
      const key = store.slug;
      let bucket = byStore.get(key);
      if (!bucket) {
        bucket = {
          store_slug: store.slug,
          store_name: store.name,
          store_logo_url: store.logo_url,
          points: [],
        };
        byStore.set(key, bucket);
      }
      bucket.points.push({
        recorded_at: point.recorded_at,
        price_cash: point.price_cash,
        price_normal: point.price_normal,
      });
    }

    return c.json({
      days,
      series: Array.from(byStore.values()),
    });
  },
);

// POST /products/:slug/view
products.post("/:slug/view", async (c) => {
  const supabase = createSupabase(c.env);
  const slug = c.req.param("slug");

  const { error } = await supabase.rpc("increment_product_view", {
    p_slug: slug,
  });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

// GET /products/:slug
products.get(
  "/:slug",
  Cache({
    mode: "public",
    ttl: CACHE_TTL.LONG,
    name: "product-detail",
  }),
  async (c) => {
    const supabase = createSupabase(c.env);
    const slug = c.req.param("slug");

    // obtener el producto principal
    const { data: product, error: productError } = await supabase
      .from("api_products")
      .select("id, name, slug, image_url, specs, prices, brand, category, listings_count, mpn, group_id")
      .eq("slug", slug)
      .single();

    if (productError || !product) {
      return c.json({ error: productError?.message || "Product not found" }, 404);
    }

    if (!product.id) {
      return c.json({ error: "Invalid product data" }, 500);
    }

    // Obtener variantes si existe group_id
    let variants: Record<string, unknown>[] = [];
    if (product.group_id) {
      const { data: variantsData } = await supabase
        .from("api_products")
        .select("name, slug, image_url, specs, prices")
        .eq("group_id", product.group_id)
        .neq("id", product.id); // Exclude current product

      if (variantsData) {
        variants = variantsData;
      }
    }

    // Obtener listados activos para este producto
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select(`
      id,
      price_cash,
      price_normal,
      url,
      is_active,
      last_scraped_at,
      store:stores(name, slug, logo_url, appearance)
    `)
      .eq("product_id", product.id)
      .eq("is_active", true)
      .order("price_cash", { ascending: true });

    if (listingsError) {
      console.error("Error fetching listings:", listingsError);
      // Aún devolvemos el producto aunque fallen los listados
    }

    return c.json({
      ...product,
      variants,
      listings: listings || [],
    });
  },
);

// GET /products
products.get(
  "/",
  Cache({
    mode: "public",
    ttl: CACHE_TTL.SHORT,
    name: "product-list",
  }),
  async (c) => {
    const supabase = createSupabase(c.env);
    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 20;
    const offset = (page - 1) * limit;

    // Filtros estándar
    const category = c.req.query("category") || undefined;
    const brand = c.req.query("brand") || undefined;
    const search = c.req.query("search") || undefined;
    const minPrice = c.req.query("min_price") ? Number(c.req.query("min_price")) : undefined;
    const maxPrice = c.req.query("max_price") ? Number(c.req.query("max_price")) : undefined;
    const sort = c.req.query("sort") || "price_asc";

    // Construcción del objeto de filtros para especificaciones
    // Soporta:
    // ?specs[socket]=AM5            -> Coincidencia exacta
    // ?specs[socket]=AM5&specs[socket]=AM4 -> Multi-select (array)
    // ?specs[speed][min]=3200       -> Rango mínimo
    // ?specs[speed][max]=6000       -> Rango máximo
    // biome-ignore lint/suspicious/noExplicitAny: Objeto de filtro complejo
    const specsFilters: Record<string, any> = {};
    const queries = c.req.queries(); // Devuelve un objeto Record<string, string[]>

    for (const [key, values] of Object.entries(queries)) {
      if (key.startsWith("specs[")) {
        // Analiza claves como "specs[speed][min]" o "specs[socket]"
        const matches = key.match(/specs\[(.*?)\](?:\[(.*?)\])?/);
        if (matches) {
          const specKey = matches[1];
          const subKey = matches[2];

          if (subKey) {
            // Range filter: specs[speed][min] / specs[speed][max]
            if (!specsFilters[specKey]) specsFilters[specKey] = {};
            specsFilters[specKey][subKey] = values[0];
          } else {
            // Select/boolean filter: pass array if multiple values, string if single
            specsFilters[specKey] = values.length === 1 ? values[0] : values;
          }
        }
      }
    }

    // Llama a la función RPC en Supabase
    const { data, error } = await supabase.rpc("filter_products", {
      p_category_slug: category,
      p_brand_slug: brand,
      p_min_price: minPrice,
      p_max_price: maxPrice,
      p_search: search,
      p_specs_filters: specsFilters,
      p_sort_by: sort,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    // La función RPC devuelve una lista plana; obtenemos el total desde la primera fila (si existe)
    // o 0 si está vacío. La RPC incluye una columna 'total_count'.
    const total = data && data.length > 0 ? Number(data[0].total_count) : 0;

    const cleanData = data?.map((item: Record<string, unknown>) => {
      const { total_count: _total_count, ...rest } = item;
      return rest;
    });

    return c.json({
      data: cleanData || [],
      meta: {
        page,
        limit,
        total,
        totalPages: total ? Math.ceil(total / limit) : 0,
      },
    });
  },
);

export default products;
