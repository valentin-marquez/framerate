-- Exclude inactive or zero-priced products from search results

-- Update quick_search_products to exclude products with no active listings or zero price
CREATE OR REPLACE FUNCTION public.quick_search_products(
    search_term text,
    p_limit int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    brand_name text,
    category_name text,
    current_price numeric,
    image_url text,
    rank real
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT
        p.id,
        p.name,
        p.slug,
        b.name as brand_name,
        c.name as category_name,
        (
            SELECT MIN(l.price_cash)
            FROM public.listings l
            WHERE l.product_id = p.id AND l.is_active = true
        ) as current_price,
        p.image_url,
        ts_rank(p.search_vector, plainto_tsquery('spanish', search_term)) as rank
    FROM public.products p
    LEFT JOIN public.brands b ON p.brand_id = b.id
    LEFT JOIN public.categories c ON p.category_id = c.id
    WHERE
        p.search_vector @@ plainto_tsquery('spanish', search_term)
        AND EXISTS (
             SELECT 1 FROM public.listings l
             WHERE l.product_id = p.id
               AND l.is_active = true
               AND l.price_cash > 0
        )
    ORDER BY
        rank DESC,
        current_price ASC
    LIMIT p_limit;
$$;

-- Update search_products to exclude products with no active listings or zero price
-- Note: Assuming products_with_prices view calculates min_price_cash from active listings only
CREATE OR REPLACE FUNCTION public.search_products(
    search_term text,
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS SETOF public.products_with_prices
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT pwp.*
    FROM public.products_with_prices pwp
    JOIN public.products p ON pwp.id = p.id
    WHERE
        (p.search_vector @@ plainto_tsquery('spanish', search_term)
        OR
        to_tsvector('spanish', pwp.brand_name || ' ' || pwp.category_name) @@ plainto_tsquery('spanish', search_term))
        AND pwp.min_price_cash > 0
    ORDER BY
        ts_rank(p.search_vector, plainto_tsquery('spanish', search_term)) DESC,
        pwp.min_price_cash ASC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
$$;
