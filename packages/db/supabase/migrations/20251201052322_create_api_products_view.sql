-- View: api_products
-- Optimized view for API consumption.
-- Hides internal IDs and timestamps, and structures data as JSON objects.
CREATE OR REPLACE VIEW public.api_products AS
SELECT
    p.id,
    p.name,
    p.slug,
    p.image_url,
    p.specs,
    -- Grouped Prices
    jsonb_build_object(
        'cash', (SELECT MIN(l.price_cash) FROM public.listings l WHERE l.product_id = p.id AND l.is_active = true),
        'normal', (SELECT MIN(l.price_normal) FROM public.listings l WHERE l.product_id = p.id AND l.is_active = true)
    ) as prices,
    -- Grouped Brand
    jsonb_build_object(
        'name', b.name,
        'slug', b.slug
    ) as brand,
    -- Grouped Category
    jsonb_build_object(
        'name', c.name,
        'slug', c.slug
    ) as category,
    -- Listings Count
    (
        SELECT COUNT(*)
        FROM public.listings l
        WHERE l.product_id = p.id AND l.is_active = true
    ) as listings_count,
    -- Filter helpers (kept at root for efficient WHERE clauses)
    c.slug as category_slug,
    b.slug as brand_slug,
    p.mpn
FROM
    public.products p
    JOIN public.categories c ON p.category_id = c.id
    JOIN public.brands b ON p.brand_id = b.id;
-- Grant access
GRANT SELECT ON public.api_products TO anon, authenticated, service_role;
-- Update search function to return the new view structure
DROP FUNCTION IF EXISTS public.search_products(text, int, int);
CREATE OR REPLACE FUNCTION public.search_products(
    search_term text,
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS SETOF public.api_products
LANGUAGE sql
STABLE
AS $$
    SELECT *
    FROM public.api_products
    WHERE
        to_tsvector('spanish', name || ' ' || (brand->>'name') || ' ' || (category->>'name') || ' ' || COALESCE(mpn, '')) @@ plainto_tsquery('spanish', search_term)
    ORDER BY
        ts_rank(to_tsvector('spanish', name || ' ' || (brand->>'name') || ' ' || (category->>'name') || ' ' || COALESCE(mpn, '')) , plainto_tsquery('spanish', search_term)) DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;
