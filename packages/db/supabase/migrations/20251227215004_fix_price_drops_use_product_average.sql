-- Migration: Update get_price_drops to use product normal price and best current offer per product
DROP FUNCTION IF EXISTS get_price_drops(float, int, int);
CREATE OR REPLACE FUNCTION get_price_drops(
    min_discount_percent float DEFAULT 10,
    lookback_days int DEFAULT 30,
    limit_count int DEFAULT 20
)
RETURNS TABLE (
    product_id uuid,
    product_name text,
    product_slug text,
    product_image_url text,
    category_slug text,
    product_specs jsonb,
    current_price numeric,
    previous_price numeric,
    discount_percentage numeric,
    store_name text,
    store_logo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH cheapest_current AS (
        -- Best (lowest) current price per product among active listings
        SELECT DISTINCT ON (l.product_id)
            l.id as listing_id,
            l.product_id,
            l.store_id,
            l.price_cash as current_price
        FROM listings l
        WHERE l.is_active = true
            AND l.price_cash > 0
        ORDER BY l.product_id, l.price_cash ASC
    ),
    product_normal AS (
        -- Normal price per product (minimum normal price among active listings)
        SELECT
            l.product_id,
            MIN(l.price_normal) as product_normal
        FROM listings l
        WHERE l.is_active = true
            AND l.price_normal > 0
        GROUP BY l.product_id
    ),
    drops AS (
        SELECT
            cc.listing_id,
            cc.product_id,
            cc.store_id,
            cc.current_price,
            pn.product_normal as normal_price,
            CASE
                WHEN pn.product_normal > 0 THEN ((pn.product_normal - cc.current_price) / pn.product_normal) * 100
                ELSE 0
            END as discount_pct
        FROM cheapest_current cc
        JOIN product_normal pn ON cc.product_id = pn.product_id
        WHERE pn.product_normal > 0
            AND cc.current_price < pn.product_normal
    )
    SELECT
        p.id as product_id,
        p.name as product_name,
        p.slug as product_slug,
        p.image_url as product_image_url,
        c.slug as category_slug,
        p.specs as product_specs,
        d.current_price::numeric,
        d.normal_price::numeric as previous_price,
        d.discount_pct::numeric as discount_percentage,
        s.name as store_name,
        s.logo_url as store_logo_url
    FROM drops d
    JOIN products p ON d.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN stores s ON d.store_id = s.id
    WHERE d.discount_pct >= min_discount_percent
    ORDER BY d.discount_pct DESC
    LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_price_drops(float, int, int) TO anon, authenticated, service_role;
