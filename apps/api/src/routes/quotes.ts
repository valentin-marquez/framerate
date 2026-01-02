/**
 * @module routes/quotes
 *
 * Rutas de la API para el sistema de cotizaciones inteligentes.
 * Incluye CRUD completo de cotizaciones y análisis de compatibilidad.
 */

import { ALL_RULES, CompatibilityEngine } from "@framerate/core/builder";
import type {
  AnalyzeBuildRequest,
  BuildComponentCategory,
  BuildComponentsMap,
  BuildProduct,
  Json,
} from "@framerate/db";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware } from "@/middleware/auth";

const quotes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Instanciar el motor de compatibilidad con todas las reglas activas
const compatibilityEngine = new CompatibilityEngine(ALL_RULES);

/**
 * POST /v1/quotes/analyze
 *
 * Analiza la compatibilidad de un conjunto de productos sin autenticación.
 * Este endpoint NO guarda nada en base de datos, solo analiza y responde.
 * Ideal para validación en tiempo real mientras el usuario construye su cotización.
 *
 * Request Body:
 * {
 *   "productIds": ["uuid1", "uuid2", ...]
 * }
 */
quotes.post("/analyze", async (c) => {
  try {
    const body = await c.req.json<AnalyzeBuildRequest>();

    if (!body.productIds || !Array.isArray(body.productIds)) {
      return c.json({ error: "productIds array is required" }, 400);
    }

    if (body.productIds.length === 0) {
      return c.json({ error: "productIds array cannot be empty" }, 400);
    }

    if (body.productIds.length > 20) {
      return c.json({ error: "Maximum 20 products per analysis" }, 400);
    }

    const supabase = createSupabase(c.env);

    // Obtener productos con sus categorías y specs
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        mpn,
        image_url,
        specs,
        category:categories(slug, name),
        brand:brands(name)
      `)
      .in("id", body.productIds);

    if (productsError) {
      console.error("Error fetching products:", productsError);
      return c.json({ error: "Failed to fetch products" }, 500);
    }

    if (!products || products.length === 0) {
      return c.json({ error: "No products found with provided IDs" }, 404);
    }

    // Mapear productos a categorías para el análisis
    const componentsMap = mapProductsToComponents(products as unknown as BuildProduct[]);

    // Ejecutar análisis
    const analysis = compatibilityEngine.run(componentsMap);

    return c.json(analysis);
  } catch (error) {
    console.error("Error analyzing build:", error);
    return c.json({ error: "Internal server error during analysis" }, 500);
  }
});

/**
 * GET /v1/quotes/user/:username
 *
 * Obtiene las cotizaciones de un usuario específico.
 * Si el usuario solicitante es el mismo, devuelve todas.
 * Si es otro usuario o anónimo, solo devuelve las públicas.
 */
quotes.get("/user/:username", async (c) => {
  try {
    const username = c.req.param("username");
    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const offset = (page - 1) * limit;

    // Extract token from header
    const authHeader = c.req.header("Authorization");
    const token = authHeader ? authHeader.replace("Bearer ", "") : undefined;

    // Create supabase client with token if available
    const supabase = createSupabase(c.env, token);

    // 1. Obtener ID del usuario por username
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, created_at")
      .eq("username", username)
      .single();

    if (profileError || !profile) {
      return c.json({ error: "User not found" }, 404);
    }

    // 2. Determinar si el solicitante es el dueño
    let isOwner = false;
    if (token) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && user.id === profile.id) {
        isOwner = true;
      }
    }

    // 3. Construir query de cotizaciones
    let query = supabase
      .from("quotes")
      .select(
        `
        id,
        name,
        description,
        is_public,
        compatibility_status,
        estimated_wattage,
        validation_errors,
        last_analyzed_at,
        created_at,
        updated_at,
        quote_items(count)
      `,
        { count: "exact" },
      )
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Si no es el dueño, filtrar solo públicas
    if (!isOwner) {
      query = query.eq("is_public", true);
    }

    const { data: quotesData, count, error: quotesError } = await query;

    if (quotesError) {
      console.error("Error fetching user quotes:", quotesError);
      return c.json({ error: "Failed to fetch quotes" }, 500);
    }

    return c.json({
      user: profile,
      data: quotesData || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile quotes:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

quotes.use("/*", authMiddleware);

/**
 * GET /v1/quotes
 *
 * Lista todas las cotizaciones del usuario autenticado.
 * Soporta paginación y filtros.
 */
quotes.get("/", async (c) => {
  try {
    const user = c.get("user");
    const supabase = createSupabase(c.env, c.get("token"));

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const offset = (page - 1) * limit;

    // Obtener cotizaciones con conteo de items
    const { data: quotesData, error: quotesError } = await supabase
      .from("quotes")
      .select(`
        id,
        name,
        description,
        is_public,
        compatibility_status,
        estimated_wattage,
        validation_errors,
        last_analyzed_at,
        created_at,
        updated_at,
        quote_items(count)
      `)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (quotesError) {
      console.error("Error fetching quotes:", quotesError);
      return c.json({ error: "Failed to fetch quotes" }, 500);
    }

    // Obtener total para paginación
    const { count, error: countError } = await supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.error("Error counting quotes:", countError);
    }

    return c.json({
      data: quotesData || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
    });
  } catch (error) {
    console.error("Error listing quotes:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /v1/quotes
 *
 * Crea una nueva cotización para el usuario autenticado.
 *
 * Request Body:
 * {
 *   "name": "Mi PC Gamer 2025",
 *   "description": "Build para juegos 4K",
 *   "is_public": false
 * }
 */
quotes.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json<{
      name: string;
      description?: string;
      is_public?: boolean;
    }>();

    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: "name is required" }, 400);
    }

    if (body.name.length > 100) {
      return c.json({ error: "name must be 100 characters or less" }, 400);
    }

    const supabase = createSupabase(c.env, c.get("token"));

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        is_public: body.is_public || false,
      })
      .select()
      .single();

    if (quoteError) {
      console.error("Error creating quote:", quoteError);
      return c.json({ error: "Failed to create quote" }, 500);
    }

    return c.json(quote, 201);
  } catch (error) {
    console.error("Error creating quote:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/quotes/:id
 *
 * Obtiene una cotización específica con todos sus items y productos.
 * Solo el dueño o cotizaciones públicas pueden ser accedidas.
 */
quotes.get("/:id", async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");
    const supabase = createSupabase(c.env, c.get("token"));

    // Obtener la cotización
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`
        id,
        name,
        description,
        is_public,
        compatibility_status,
        estimated_wattage,
        validation_errors,
        last_analyzed_at,
        created_at,
        updated_at,
        user_id
      `)
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      return c.json({ error: "Quote not found" }, 404);
    }

    // Verificar permisos (dueño o pública)
    if (quote.user_id !== user.id && !quote.is_public) {
      return c.json({ error: "Access denied" }, 403);
    }

    // Obtener items con productos completos y listing seleccionado
    const { data: items, error: itemsError } = await supabase
      .from("quote_items")
      .select(`
        id,
        quantity,
        created_at,
        listing_id,
        listing:listings(
          id,
          price_normal,
          price_cash,
          url,
          store:stores(name, logo_url, slug)
        ),
        product:products(
          id,
          name,
          slug,
          mpn,
          image_url,
          specs,
          brand:brands(name, slug),
          category:categories(name, slug)
        )
      `)
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: true });

    if (itemsError) {
      console.error("Error fetching quote items:", itemsError);
      return c.json({ error: "Failed to fetch quote items" }, 500);
    }

    // Obtener precios actuales de los listings (para los que no tienen listing seleccionado)
    const productIds = items?.map((item) => item.product?.id).filter(Boolean) || [];

    let productsWithPrices = items?.map((item) => item.product) || [];

    if (productIds.length > 0) {
      const { data: pricesData } = await supabase.from("api_products").select("id, prices").in("id", productIds);

      if (pricesData) {
        productsWithPrices =
          items?.map((item) => {
            const priceInfo = pricesData.find((p) => p.id === item.product?.id);
            return {
              ...item.product,
              prices: priceInfo?.prices || { cash: null, normal: null },
            };
          }) || [];
      }
    }

    // Calcular precio total
    const totalCash = productsWithPrices.reduce((sum, product, index) => {
      const item = items?.[index];
      const quantity = item?.quantity || 1;

      // Si hay un listing seleccionado, usar su precio
      if (item?.listing) {
        // @ts-expect-error - Supabase types might not be fully updated in the workspace
        return sum + (item.listing.price_cash || 0) * quantity;
      }

      // Si no, usar el mejor precio global
      const prices = (product as unknown as BuildProduct & { prices?: { cash?: number } })?.prices;
      const price = prices?.cash || 0;
      return sum + price * quantity;
    }, 0);

    const totalNormal = productsWithPrices.reduce((sum, product, index) => {
      const item = items?.[index];
      const quantity = item?.quantity || 1;

      // Si hay un listing seleccionado, usar su precio
      if (item?.listing) {
        // @ts-expect-error
        return sum + (item.listing.price_normal || 0) * quantity;
      }

      const prices = (product as unknown as BuildProduct & { prices?: { normal?: number } })?.prices;
      const price = prices?.normal || 0;
      return sum + price * quantity;
    }, 0);

    return c.json({
      ...quote,
      items:
        items?.map((item, index) => ({
          id: item.id,
          quantity: item.quantity,
          created_at: item.created_at,
          listing_id: item.listing_id,
          selected_listing: item.listing,
          product: productsWithPrices[index],
        })) || [],
      totals: {
        cash: totalCash,
        normal: totalNormal,
      },
    });
  } catch (error) {
    console.error("Error fetching quote:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * PATCH /v1/quotes/:id
 *
 * Actualiza información de una cotización.
 * Solo el dueño puede actualizar.
 */
quotes.patch("/:id", async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");
    const body = await c.req.json<{
      name?: string;
      description?: string;
      is_public?: boolean;
    }>();

    const supabase = createSupabase(c.env, c.get("token"));

    // Verificar ownership
    const { data: existing } = await supabase.from("quotes").select("user_id").eq("id", quoteId).single();

    if (!existing || existing.user_id !== user.id) {
      return c.json({ error: "Quote not found or access denied" }, 404);
    }

    // Construir update object
    const updates: {
      name?: string;
      description?: string | null;
      is_public?: boolean;
      updated_at: string;
    } = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        return c.json({ error: "name cannot be empty" }, 400);
      }
      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description.trim() || null;
    }

    if (body.is_public !== undefined) {
      updates.is_public = body.is_public;
    }

    const { data: quote, error: updateError } = await supabase
      .from("quotes")
      .update(updates)
      .eq("id", quoteId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating quote:", updateError);
      return c.json({ error: "Failed to update quote" }, 500);
    }

    return c.json(quote);
  } catch (error) {
    console.error("Error updating quote:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * DELETE /v1/quotes/:id
 *
 * Elimina una cotización y todos sus items.
 * Solo el dueño puede eliminar.
 */
quotes.delete("/:id", async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");
    const supabase = createSupabase(c.env, c.get("token"));

    // Verificar ownership
    const { data: existing } = await supabase.from("quotes").select("user_id").eq("id", quoteId).single();

    if (!existing || existing.user_id !== user.id) {
      return c.json({ error: "Quote not found or access denied" }, 404);
    }

    // Eliminar (cascade eliminará los items automáticamente)
    const { error: deleteError } = await supabase.from("quotes").delete().eq("id", quoteId);

    if (deleteError) {
      console.error("Error deleting quote:", deleteError);
      return c.json({ error: "Failed to delete quote" }, 500);
    }

    return c.json({ success: true, message: "Quote deleted successfully" });
  } catch (error) {
    console.error("Error deleting quote:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/quotes/:id/analyze
 *
 * Analiza una cotización existente guardada en la base de datos.
 * Actualiza el cache de compatibilidad en la BD.
 */
quotes.get("/:id/analyze", async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");
    const supabase = createSupabase(c.env, c.get("token"));

    // Verificar acceso
    const { data: quote } = await supabase.from("quotes").select("user_id, is_public").eq("id", quoteId).single();

    if (!quote || (quote.user_id !== user.id && !quote.is_public)) {
      return c.json({ error: "Quote not found or access denied" }, 404);
    }

    // Obtener items de la cotización
    const { data: quoteItems, error: itemsError } = await supabase
      .from("quote_items")
      .select(`
        quantity,
        product:products(
          id,
          name,
          slug,
          mpn,
          image_url,
          specs,
          category:categories(slug, name),
          brand:brands(name)
        )
      `)
      .eq("quote_id", quoteId);

    if (itemsError) {
      console.error("Error fetching quote items:", itemsError);
      return c.json({ error: "Failed to fetch quote items" }, 500);
    }

    if (!quoteItems || quoteItems.length === 0) {
      return c.json({
        status: "valid",
        estimatedWattage: 0,
        issues: [],
        analyzedAt: new Date().toISOString(),
      });
    }

    // Mapear a BuildComponentsMap
    const products = quoteItems.map((item) => item.product).filter(Boolean) as unknown as BuildProduct[];
    const componentsMap = mapProductsToComponents(products);

    // Ejecutar análisis
    const analysis = compatibilityEngine.run(componentsMap);

    // Actualizar cache en la BD (solo si es el dueño)
    if (quote.user_id === user.id) {
      await supabase
        .from("quotes")
        .update({
          compatibility_status: analysis.status,
          estimated_wattage: analysis.estimatedWattage,
          validation_errors: analysis.issues as unknown as Json,
          last_analyzed_at: analysis.analyzedAt,
        })
        .eq("id", quoteId);
    }

    return c.json(analysis);
  } catch (error) {
    console.error("Error analyzing quote:", error);
    return c.json({ error: "Internal server error during analysis" }, 500);
  }
});

/**
 * POST /v1/quotes/:id/items
 *
 * Agrega un producto a la cotización.
 *
 * Request Body:
 * {
 *   "product_id": "uuid",
 *   "quantity": 1
 * }
 */
quotes.post("/:id/items", async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");
    const body = await c.req.json<{
      product_id: string;
      quantity?: number;
      listing_id?: string;
    }>();

    if (!body.product_id) {
      return c.json({ error: "product_id is required" }, 400);
    }

    const quantity = body.quantity || 1;

    if (quantity < 1 || quantity > 99) {
      return c.json({ error: "quantity must be between 1 and 99" }, 400);
    }

    const supabase = createSupabase(c.env, c.get("token"));

    // Verificar ownership
    const { data: quote } = await supabase.from("quotes").select("user_id").eq("id", quoteId).single();

    if (!quote || quote.user_id !== user.id) {
      return c.json({ error: "Quote not found or access denied" }, 404);
    }

    // Verificar que el producto existe
    const { data: product } = await supabase.from("products").select("id").eq("id", body.product_id).single();

    if (!product) {
      return c.json({ error: "Product not found" }, 404);
    }

    // Verificar si ya existe el producto en la cotización
    const { data: existing } = await supabase
      .from("quote_items")
      .select("id, quantity")
      .eq("quote_id", quoteId)
      .eq("product_id", body.product_id)
      .single();

    if (existing) {
      // Actualizar cantidad si ya existe
      const updates: any = { quantity: existing.quantity + quantity };
      if (body.listing_id !== undefined) {
        updates.listing_id = body.listing_id;
      }

      const { data: updated, error: updateError } = await supabase
        .from("quote_items")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating quote item:", updateError);
        return c.json({ error: "Failed to update item quantity" }, 500);
      }

      return c.json(updated);
    }

    // Crear nuevo item
    const { data: item, error: itemError } = await supabase
      .from("quote_items")
      .insert({
        quote_id: quoteId,
        product_id: body.product_id,
        quantity: quantity,
        listing_id: body.listing_id || null,
      })
      .select()
      .single();

    if (itemError) {
      console.error("Error creating quote item:", itemError);
      return c.json({ error: "Failed to add item to quote" }, 500);
    }

    return c.json(item, 201);
  } catch (error) {
    console.error("Error adding item to quote:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * PATCH /v1/quotes/:id/items/:itemId
 *
 * Actualiza la cantidad de un item.
 *
 * Request Body:
 * {
 *   "quantity": 2
 * }
 */
quotes.patch("/:id/items/:itemId", async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");
    const itemId = c.req.param("itemId");
    const body = await c.req.json<{ quantity?: number; listing_id?: string | null }>();

    if (body.quantity !== undefined && (body.quantity < 1 || body.quantity > 99)) {
      return c.json({ error: "quantity must be between 1 and 99" }, 400);
    }

    const supabase = createSupabase(c.env, c.get("token"));

    // Verificar ownership de la cotización
    const { data: quote } = await supabase.from("quotes").select("user_id").eq("id", quoteId).single();

    if (!quote || quote.user_id !== user.id) {
      return c.json({ error: "Quote not found or access denied" }, 404);
    }

    const updates: any = {};
    if (body.quantity !== undefined) updates.quantity = body.quantity;
    if (body.listing_id !== undefined) updates.listing_id = body.listing_id;

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No updates provided" }, 400);
    }

    // Actualizar item
    const { data: item, error: updateError } = await supabase
      .from("quote_items")
      .update(updates)
      .eq("id", itemId)
      .eq("quote_id", quoteId)
      .select()
      .single();

    if (updateError || !item) {
      return c.json({ error: "Item not found or failed to update" }, 404);
    }

    return c.json(item);
  } catch (error) {
    console.error("Error updating quote item:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * DELETE /v1/quotes/:id/items/:itemId
 *
 * Elimina un item de la cotización.
 */
quotes.delete("/:id/items/:itemId", async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");
    const itemId = c.req.param("itemId");
    const supabase = createSupabase(c.env, c.get("token"));

    // Verificar ownership
    const { data: quote } = await supabase.from("quotes").select("user_id").eq("id", quoteId).single();

    if (!quote || quote.user_id !== user.id) {
      return c.json({ error: "Quote not found or access denied" }, 404);
    }

    // Eliminar item
    const { error: deleteError } = await supabase.from("quote_items").delete().eq("id", itemId).eq("quote_id", quoteId);

    if (deleteError) {
      console.error("Error deleting quote item:", deleteError);
      return c.json({ error: "Failed to delete item" }, 500);
    }

    return c.json({ success: true, message: "Item removed successfully" });
  } catch (error) {
    console.error("Error deleting quote item:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * Mapea un slug de categoría de la BD a un BuildComponentCategory.
 */
function mapCategorySlugToComponent(slug: string): BuildComponentCategory | null {
  const mapping: Record<string, BuildComponentCategory> = {
    cpu: "cpu",
    gpu: "gpu",
    motherboard: "motherboard",
    ram: "ram",
    psu: "psu",
    case: "case",
    "cpu-cooler": "cpu-cooler",
    ssd: "ssd",
    hdd: "hdd",
    "case-fan": "case-fan",
  };

  return mapping[slug] || null;
}

/**
 * Mapea una lista de productos a un BuildComponentsMap.
 */
function mapProductsToComponents(products: BuildProduct[]): BuildComponentsMap {
  const componentsMap: BuildComponentsMap = {};

  for (const product of products) {
    const categorySlug = product.category?.slug;
    if (!categorySlug) continue;

    const componentCategory = mapCategorySlugToComponent(categorySlug);
    if (componentCategory) {
      componentsMap[componentCategory] = product;
    }
  }

  return componentsMap;
}

export default quotes;
