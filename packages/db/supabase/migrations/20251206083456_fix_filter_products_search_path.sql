CREATE OR REPLACE FUNCTION public.filter_products(
    p_category_slug text DEFAULT NULL,
    p_brand_slug text DEFAULT NULL,
    p_min_price integer DEFAULT NULL,
    p_max_price integer DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_specs_filters jsonb DEFAULT '{}'::jsonb,
    p_sort_by text DEFAULT 'price_asc', -- price_asc, price_desc, popularity, discount, newest
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
    popularity_score bigint,
    mpn text,
    group_id uuid,
    created_at timestamp with time zone,
    total_count bigint
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_query text;
    v_spec_key text;
    v_spec_filter jsonb;
    v_min numeric;
    v_max numeric;
    v_value text;
BEGIN
    -- Consulta base
    v_query := '
        WITH filtered_items AS (
            SELECT *, count(*) OVER() as full_count
            FROM public.api_products
            WHERE 1=1
    ';

    -- Filtros estándar
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

    -- Filtros dinámicos de especificaciones
    FOR v_spec_key, v_spec_filter IN SELECT * FROM jsonb_each(p_specs_filters)
    LOOP
        IF v_spec_filter ? 'min' OR v_spec_filter ? 'max' THEN
            IF v_spec_filter ? 'min' THEN
                v_min := (v_spec_filter->>'min')::numeric;
                v_query := v_query || format(' AND public.extract_numeric_value(specs->>%L) >= %s', v_spec_key, v_min);
            END IF;
            IF v_spec_filter ? 'max' THEN
                v_max := (v_spec_filter->>'max')::numeric;
                v_query := v_query || format(' AND public.extract_numeric_value(specs->>%L) <= %s', v_spec_key, v_max);
            END IF;
        ELSE
            v_value := v_spec_filter->>0;
            IF v_value IS NULL THEN
                 v_value := v_spec_filter::text;
                 IF left(v_value, 1) = '"' THEN v_value := substring(v_value from 2 for length(v_value)-2); END IF;
            END IF;
            v_query := v_query || format(' AND specs->>%L = %L', v_spec_key, v_value);
        END IF;
    END LOOP;

    -- Lógica de ordenamiento
    CASE p_sort_by
        WHEN 'price_desc' THEN
            v_query := v_query || ' ORDER BY (prices->>''cash'')::int DESC';
        WHEN 'popularity' THEN
            v_query := v_query || ' ORDER BY popularity_score DESC, created_at DESC';
        WHEN 'discount' THEN
            v_query := v_query || ' ORDER BY ( ((prices->>''normal'')::numeric - (prices->>''cash'')::numeric) / NULLIF((prices->>''normal'')::numeric, 0) ) DESC';
        WHEN 'name' THEN
            v_query := v_query || ' ORDER BY name ASC';
        WHEN 'newest' THEN
            v_query := v_query || ' ORDER BY created_at DESC';
        ELSE -- price_asc o por defecto
            v_query := v_query || ' ORDER BY (prices->>''cash'')::int ASC';
    END CASE;

    -- Paginación
    v_query := v_query || format('
            LIMIT %s OFFSET %s
        )
        SELECT 
            id, name, slug, image_url, specs, prices, brand, category, listings_count, popularity_score, mpn, group_id, created_at, full_count
        FROM filtered_items;
    ', p_limit, p_offset);

    RETURN QUERY EXECUTE v_query;
END;
$$;
