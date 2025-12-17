-- 1. Fix Security Warning on View
-- Re-create the view with security_invoker = true
CREATE OR REPLACE VIEW public.api_products
WITH (security_invoker = true)
AS
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
    -- Filter helpers
    c.slug as category_slug,
    b.slug as brand_slug,
    p.mpn,
    p.group_id
FROM
    public.products p
    JOIN public.categories c ON p.category_id = c.id
    JOIN public.brands b ON p.brand_id = b.id;
-- 2. Helper function to extract numbers from specs strings
-- e.g. "3200 MHz" -> 3200, "16 GB" -> 16
CREATE OR REPLACE FUNCTION public.extract_numeric_value(input_text text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE STRICT
AS $$
    SELECT (regexp_matches(input_text, '(\d+(\.\d+)?)'))[1]::numeric;
$$;
-- 3. Advanced Filter Function
-- Allows filtering by numeric ranges on JSONB specs
CREATE OR REPLACE FUNCTION public.filter_products(
    p_category_slug text DEFAULT NULL,
    p_brand_slug text DEFAULT NULL,
    p_min_price integer DEFAULT NULL,
    p_max_price integer DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_specs_filters jsonb DEFAULT '{}'::jsonb, -- e.g. {"speed": {"min": 3000}, "capacity": {"min": 16}}
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    image_url text,
    specs jsonb,
    prices jsonb,
    brand jsonb,
    category jsonb,
    listings_count bigint,
    mpn text,
    group_id uuid,
    total_count bigint
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_query text;
    v_spec_key text;
    v_spec_filter jsonb;
    v_min numeric;
    v_max numeric;
    v_value text;
BEGIN
    -- Base query on the secure view
    v_query := '
        WITH filtered_items AS (
            SELECT *, count(*) OVER() as full_count
            FROM public.api_products
            WHERE 1=1
    ';

    -- Standard Filters
    IF p_category_slug IS NOT NULL THEN
        v_query := v_query || format(' AND category_slug = %L', p_category_slug);
    END IF;

    IF p_brand_slug IS NOT NULL THEN
        v_query := v_query || format(' AND brand_slug = %L', p_brand_slug);
    END IF;

    IF p_min_price IS NOT NULL THEN
        v_query := v_query || format(' AND (prices->>''cash'')::int >= %s', p_min_price);
    END IF;

    IF p_max_price IS NOT NULL THEN
        v_query := v_query || format(' AND (prices->>''cash'')::int <= %s', p_max_price);
    END IF;

    IF p_search IS NOT NULL AND p_search <> '' THEN
        v_query := v_query || format(' AND to_tsvector(''spanish'', name || '' '' || (brand->>''name'') || '' '' || (category->>''name'') || '' '' || COALESCE(mpn, '''')) @@ plainto_tsquery(''spanish'', %L)', p_search);
    END IF;

    -- Dynamic Specs Filters
    -- Iterate over keys in p_specs_filters
    FOR v_spec_key, v_spec_filter IN SELECT * FROM jsonb_each(p_specs_filters)
    LOOP
        -- Check for Range Filters (min/max)
        IF v_spec_filter ? 'min' OR v_spec_filter ? 'max' THEN
            IF v_spec_filter ? 'min' THEN
                v_min := (v_spec_filter->>'min')::numeric;
                -- Use extract_numeric_value for comparison
                v_query := v_query || format(' AND public.extract_numeric_value(specs->>%L) >= %s', v_spec_key, v_min);
            END IF;
            IF v_spec_filter ? 'max' THEN
                v_max := (v_spec_filter->>'max')::numeric;
                v_query := v_query || format(' AND public.extract_numeric_value(specs->>%L) <= %s', v_spec_key, v_max);
            END IF;
        ELSE
            -- Exact Match (or array containment if we wanted)
            -- Assuming simple string match for now if not min/max
            v_value := v_spec_filter->>0; -- Take first value if array, or value itself
            IF v_value IS NULL THEN
                 v_value := v_spec_filter::text; -- Fallback
                 -- Remove quotes if it was a json string
                 IF left(v_value, 1) = '"' THEN v_value := substring(v_value from 2 for length(v_value)-2); END IF;
            END IF;
            
            v_query := v_query || format(' AND specs->>%L = %L', v_spec_key, v_value);
        END IF;
    END LOOP;

    -- Pagination and Execution
    v_query := v_query || format('
            ORDER BY (prices->>''cash'')::int ASC
            LIMIT %s OFFSET %s
        )
        SELECT 
            id, name, slug, image_url, specs, prices, brand, category, listings_count, mpn, group_id, full_count
        FROM filtered_items;
    ', p_limit, p_offset);

    RETURN QUERY EXECUTE v_query;
END;
$$;
