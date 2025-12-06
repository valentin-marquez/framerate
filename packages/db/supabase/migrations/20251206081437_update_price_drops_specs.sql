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
    WITH recent_history AS (
        SELECT 
            ph.listing_id,
            AVG(ph.price_cash) as avg_price
        FROM price_history ph
        WHERE ph.recorded_at > (now() - (lookback_days || ' days')::interval)
        GROUP BY ph.listing_id
    ),
    drops AS (
        SELECT 
            l.id as listing_id,
            l.product_id,
            l.store_id,
            l.price_cash as current_price,
            rh.avg_price as historical_average,
            CASE 
                WHEN rh.avg_price > 0 THEN ((rh.avg_price - l.price_cash) / rh.avg_price) * 100 
                ELSE 0 
            END as discount_pct
        FROM listings l
        JOIN recent_history rh ON l.id = rh.listing_id
        WHERE 
            l.is_active = true
            AND l.price_cash > 0
            AND rh.avg_price > 0
            AND l.price_cash < rh.avg_price
    )
    SELECT 
        p.id as product_id,
        p.name as product_name,
        p.slug as product_slug,
        p.image_url as product_image_url,
        c.slug as category_slug,
        p.specs as product_specs,
        d.current_price::numeric,
        d.historical_average::numeric as previous_price,
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
