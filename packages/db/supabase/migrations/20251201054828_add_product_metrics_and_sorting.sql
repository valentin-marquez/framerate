-- 1. Crear tabla de métricas de productos
CREATE TABLE IF NOT EXISTS public.product_metrics (
    product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    views_count bigint DEFAULT 0,
    clicks_count bigint DEFAULT 0,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.product_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public metrics are viewable by everyone" 
ON public.product_metrics FOR SELECT USING (true);

-- 2. Función para incrementar vistas (Analíticas)
CREATE OR REPLACE FUNCTION public.increment_product_view(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_id uuid;
BEGIN
    SELECT id INTO v_product_id FROM public.products WHERE slug = p_slug;
    
    IF v_product_id IS NOT NULL THEN
        INSERT INTO public.product_metrics (product_id, views_count)
        VALUES (v_product_id, 1)
        ON CONFLICT (product_id)
        DO UPDATE SET 
            views_count = product_metrics.views_count + 1,
            updated_at = now();
    END IF;
END;
$$;

-- 3. Actualizar Vista api_products para incluir popularidad
-- Necesitamos eliminar la vista primero porque estamos cambiando orden/tipos de columnas
DROP VIEW IF EXISTS public.api_products CASCADE;

CREATE OR REPLACE VIEW public.api_products
WITH (security_invoker = true)
AS
SELECT
    p.id,
    p.name,
    p.slug,
    p.image_url,
    p.specs,
    -- Precios agrupados
    jsonb_build_object(
        'cash', (SELECT MIN(l.price_cash) FROM public.listings l WHERE l.product_id = p.id AND l.is_active = true),
        'normal', (SELECT MIN(l.price_normal) FROM public.listings l WHERE l.product_id = p.id AND l.is_active = true)
    ) as prices,
    -- Marca agrupada
    jsonb_build_object(
        'name', b.name,
        'slug', b.slug
    ) as brand,
    -- Categoría agrupada
    jsonb_build_object(
        'name', c.name,
        'slug', c.slug
    ) as category,
    -- Conteo de listados
    (
        SELECT COUNT(*)
        FROM public.listings l
        WHERE l.product_id = p.id AND l.is_active = true
    ) as listings_count,
    -- Métricas
    COALESCE(pm.views_count, 0) as popularity_score,
    -- Ayudantes de filtro
    c.slug as category_slug,
    b.slug as brand_slug,
    p.mpn,
    p.group_id
FROM
    public.products p
    JOIN public.categories c ON p.category_id = c.id
    JOIN public.brands b ON p.brand_id = b.id
    LEFT JOIN public.product_metrics pm ON p.id = pm.product_id;

-- 4. Actualizar filter_products para soportar ordenamiento
DROP FUNCTION IF EXISTS public.filter_products(text, text, integer, integer, text, jsonb, integer, integer);

CREATE OR REPLACE FUNCTION public.filter_products(
    p_category_slug text DEFAULT NULL,
    p_brand_slug text DEFAULT NULL,
    p_min_price integer DEFAULT NULL,
    p_max_price integer DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_specs_filters jsonb DEFAULT '{}'::jsonb,
    p_sort_by text DEFAULT 'price_asc', -- price_asc, price_desc, popularity, discount
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
            v_query := v_query || ' ORDER BY popularity_score DESC';
        WHEN 'discount' THEN
            -- Ordenar por porcentaje de descuento: (normal - efectivo) / normal
            v_query := v_query || ' ORDER BY ( ((prices->>''normal'')::numeric - (prices->>''cash'')::numeric) / NULLIF((prices->>''normal'')::numeric, 0) ) DESC';
        WHEN 'name' THEN
            v_query := v_query || ' ORDER BY name ASC';
        ELSE -- price_asc o por defecto
            v_query := v_query || ' ORDER BY (prices->>''cash'')::int ASC';
    END CASE;

    -- Paginación
    v_query := v_query || format('
            LIMIT %s OFFSET %s
        )
        SELECT 
            id, name, slug, image_url, specs, prices, brand, category, listings_count, popularity_score, mpn, group_id, full_count
        FROM filtered_items;
    ', p_limit, p_offset);

    RETURN QUERY EXECUTE v_query;
END;
$$;

