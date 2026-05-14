import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { CACHE_TTL, Cache } from "@/middleware/cache";

const categories = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /categories/:slug/filters
categories.get(
  "/:slug/filters",
  Cache({
    mode: "public",
    ttl: CACHE_TTL.MEDIUM,
    name: "category-filters",
  }),
  async (c) => {
    const supabase = createSupabase(c.env);
    const slug = c.req.param("slug");

    const { data, error } = await supabase.rpc("get_category_filters", {
      p_category_slug: slug,
    });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    // `data: Json | null` desde RPC; `c.json(data)` directo dispara TS2589 porque
    // Hono trata de expandir el union recursivo de Json. Serializamos manualmente.
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  },
);

// GET /categories/:slug/price-range
categories.get(
  "/:slug/price-range",
  Cache({
    mode: "public",
    ttl: CACHE_TTL.MEDIUM,
    name: "category-price-range",
  }),
  async (c) => {
    const supabase = createSupabase(c.env);
    const slug = c.req.param("slug");

    const { data, error } = await supabase
      .from("api_products")
      .select("prices")
      .eq("category_slug", slug)
      .not("prices", "is", null);

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    if (!data || data.length === 0) {
      return c.json({ min: 0, max: 0 });
    }

    const prices = data
      .map((p) => {
        const priceObj = (p.prices ?? {}) as { cash?: number; normal?: number };
        return priceObj.cash || priceObj.normal || 0;
      })
      .filter((p) => p > 0);

    return c.json({
      min: Math.min(...prices),
      max: Math.max(...prices),
    });
  },
);

// GET /categories/:slug/brands
categories.get(
  "/:slug/brands",
  Cache({
    mode: "public",
    ttl: CACHE_TTL.MEDIUM,
    name: "category-brands",
  }),
  async (c) => {
    const supabase = createSupabase(c.env);
    const slug = c.req.param("slug");

    const { data, error } = await supabase.from("api_products").select("brand").eq("category_slug", slug);

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    // Extract unique brands with counts
    const brandCounts: Record<string, { name: string; slug: string; count: number }> = {};

    for (const product of data || []) {
      const brand = (product.brand ?? null) as { name?: string; slug?: string } | null;
      if (brand?.slug) {
        if (!brandCounts[brand.slug]) {
          brandCounts[brand.slug] = { name: brand.name ?? brand.slug, slug: brand.slug, count: 0 };
        }
        brandCounts[brand.slug].count++;
      }
    }

    const brands = Object.values(brandCounts).sort((a, b) => b.count - a.count);

    return c.json(brands);
  },
);

// GET /categories
categories.get(
  "/",
  Cache({
    mode: "public",
    ttl: CACHE_TTL.MEDIUM,
    name: "categories-list",
  }),
  async (c) => {
    const supabase = createSupabase(c.env);
    const withCounts = c.req.query("with_counts") === "true";

    if (withCounts) {
      // Get categories with product counts
      const { data: categories, error: catError } = await supabase.from("categories").select("*").order("name");

      if (catError) {
        return c.json({ error: catError.message }, 500);
      }

      // Get product counts per category
      const { data: products, error: prodError } = await supabase.from("api_products").select("category_slug");

      if (prodError) {
        return c.json({ error: prodError.message }, 500);
      }

      // Count products per category
      const counts: Record<string, number> = {};
      for (const product of products || []) {
        const slug = product.category_slug;
        if (slug) {
          counts[slug] = (counts[slug] || 0) + 1;
        }
      }

      const result = categories?.map((cat) => ({
        ...cat,
        product_count: counts[cat.slug] || 0,
      }));

      return c.json(result);
    }

    const { data, error } = await supabase.from("categories").select("*").order("name");

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json(data);
  },
);

export default categories;
