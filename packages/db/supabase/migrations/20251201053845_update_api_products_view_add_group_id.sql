-- Update View: api_products
-- Added group_id to allow fetching variants.

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
    p.mpn,
    p.group_id
FROM
    public.products p
    JOIN public.categories c ON p.category_id = c.id
    JOIN public.brands b ON p.brand_id = b.id;
-- Grant access
GRANT SELECT ON public.api_products TO anon, authenticated, service_role;
