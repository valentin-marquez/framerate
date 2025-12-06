import { Hono } from "hono";
import type { Bindings, Variables } from "../bindings";
import { createSupabaseClient } from "../lib/supabase";
import { cache } from "../middleware/cache";

const products = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /products/search?q=term
products.get("/search", async (c) => {
  const supabase = createSupabaseClient(c.env);
  const query = c.req.query("q");
  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;

  if (!query) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  const { data, error } = await supabase.rpc("search_products" as any, {
    search_term: query,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data);
});

// GET /products/drops
products.get(
  "/drops",
  cache({
    cacheName: "product-drops",
    cacheControl: "max-age=300", // 5 minutes
  }),
  async (c) => {
    const supabase = createSupabaseClient(c.env);
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

// POST /products/:slug/view
products.post("/:slug/view", async (c) => {
  const supabase = createSupabaseClient(c.env);
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
  cache({
    cacheName: "product-detail",
    cacheControl: "max-age=3600",
  }),
  async (c) => {
    const supabase = createSupabaseClient(c.env);
    const slug = c.req.param("slug");

    // obtener el producto principal
    const { data: product, error: productError } = await supabase
      .from("api_products")
      .select(
        "id, name, slug, image_url, specs, prices, brand, category, listings_count, mpn, group_id",
      )
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
      price_cash,
      price_normal,
      url,
      is_active,
      last_scraped_at,
      store:stores(name, slug, logo_url)
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
  cache({
    cacheName: "products-list",
    cacheControl: "max-age=300",
  }),
  async (c) => {
    const supabase = createSupabaseClient(c.env);
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
    // ?specs[socket]=AM5  -> Coincidencia exacta
    // ?specs[speed][min]=3200 -> Rango mínim
    // ?specs[speed][max]=6000 -> Rango máximo
    // biome-ignore lint/suspicious/noExplicitAny: Objeto de filtro complejo
    const specsFilters: Record<string, any> = {};
    const queries = c.req.queries(); // Devuelve un objeto Record<string, string[]>

    for (const [key, values] of Object.entries(queries)) {
      // Coincide con specs[key] o specs[key][sub]
      // Por ahora, solo tomamos el primer valor ya que el RPC espera valores/objetos únicos
      const value = values[0];

      if (key.startsWith("specs[")) {
        // Analiza claves como "specs[speed][min]" o "specs[socket]"
        const matches = key.match(/specs\[(.*?)\](?:\[(.*?)\])?/);
        if (matches) {
          const specKey = matches[1];
          const subKey = matches[2];

          if (subKey) {
            if (!specsFilters[specKey]) specsFilters[specKey] = {};
            specsFilters[specKey][subKey] = value;
          } else {
            specsFilters[specKey] = value;
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
