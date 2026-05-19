-- Descuento real basado en price_history.
--
-- Antes: el "descuento" era (price_normal - price_cash) / price_normal, donde
-- price_normal NO es un precio anterior sino el precio tarjeta del MISMO
-- listing actual (≈ price_cash * 1.045/1.055). Eso producía un "-5%" fijo y
-- permanente en casi todos los productos y get_price_drops nunca leía
-- price_history (el parámetro lookback_days era código muerto).
--
-- Ahora: la referencia es el precio cash más alto que tuvo la MISMA oferta más
-- barata del producto durante la ventana (price_history del listing más barato).
-- Solo hay descuento real cuando esa oferta efectivamente bajó respecto a su
-- propio historial (>= 2 precios distintos en la ventana). El gap
-- efectivo/tarjeta (cash vs normal) ya no se trata como descuento: es un medio
-- de pago y se reetiqueta en el front.

-- 1. Helper: precio de referencia real del producto.
--    Toma el listing activo más barato y devuelve el max(price_cash) que tuvo
--    en su propio historial dentro de la ventana. NULL si no hubo movimiento
--    real (< 2 precios distintos) → sin descuento ficticio.
CREATE OR REPLACE FUNCTION public.f_price_reference(p_product_id uuid, p_lookback_days int DEFAULT 90)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
    WITH cheapest AS (
        SELECT l.id
        FROM listings l
        WHERE l.product_id = p_product_id
            AND l.is_active = true
            AND l.price_cash > 0
        ORDER BY l.price_cash ASC
        LIMIT 1
    )
    SELECT max(ph.price_cash)::int
    FROM price_history ph
    WHERE ph.listing_id = (SELECT id FROM cheapest)
        AND ph.price_cash > 0
        AND ph.recorded_at >= (now() - make_interval(days => p_lookback_days))
    HAVING count(DISTINCT ph.price_cash) >= 2;
$$;

COMMENT ON FUNCTION public.f_price_reference(uuid, int) IS
'Precio de referencia para descuento real: max(price_cash) histórico del listing activo más barato del producto en la ventana. NULL si no hubo movimiento real de precio.';

-- 2. api_products: exponer prices.reference (mismas columnas/orden → CREATE OR
--    REPLACE válido; solo cambia la expresión del jsonb prices).
CREATE OR REPLACE VIEW public.api_products
WITH (security_invoker = true)
AS
SELECT
    p.id,
    p.name,
    p.slug,
    p.image_url,
    p.specs,
    jsonb_build_object(
        'cash', (SELECT min(l.price_cash) FROM public.listings l WHERE l.product_id = p.id AND l.is_active = true),
        'normal', (SELECT min(l.price_normal) FROM public.listings l WHERE l.product_id = p.id AND l.is_active = true),
        'reference', public.f_price_reference(p.id, 90)
    ) AS prices,
    jsonb_build_object('name', b.name, 'slug', b.slug) AS brand,
    jsonb_build_object('name', c.name, 'slug', c.slug) AS category,
    (SELECT count(*) FROM public.listings l WHERE l.product_id = p.id AND l.is_active = true) AS listings_count,
    COALESCE(pm.views_count, 0::bigint) AS popularity_score,
    c.slug AS category_slug,
    b.slug AS brand_slug,
    p.mpn,
    p.group_id,
    p.created_at
FROM
    public.products p
    JOIN public.categories c ON p.category_id = c.id
    JOIN public.brands b ON p.brand_id = b.id
    LEFT JOIN public.product_metrics pm ON p.id = pm.product_id;

-- 3. get_price_drops: usar la referencia histórica real (la firma se mantiene
--    para no romper apps/api; ahora lookback_days SÍ se usa).
CREATE OR REPLACE FUNCTION public.get_price_drops(
    min_discount_percent double precision DEFAULT 10,
    lookback_days integer DEFAULT 30,
    limit_count integer DEFAULT 20
)
RETURNS TABLE(
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
SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY
    WITH cheapest_current AS (
        -- Mejor (más barata) oferta vigente por producto
        SELECT DISTINCT ON (l.product_id)
            l.product_id,
            l.store_id,
            l.price_cash AS current_price
        FROM listings l
        WHERE l.is_active = true
            AND l.price_cash > 0
        ORDER BY l.product_id, l.price_cash ASC
    ),
    drops AS (
        SELECT
            cc.product_id,
            cc.store_id,
            cc.current_price,
            public.f_price_reference(cc.product_id, lookback_days) AS ref_price
        FROM cheapest_current cc
    )
    SELECT
        p.id,
        p.name,
        p.slug,
        p.image_url,
        c.slug,
        p.specs,
        d.current_price::numeric,
        d.ref_price::numeric AS previous_price,
        (((d.ref_price - d.current_price)::numeric / NULLIF(d.ref_price, 0)) * 100) AS discount_percentage,
        s.name,
        s.logo_url
    FROM drops d
    JOIN products p ON d.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN stores s ON d.store_id = s.id
    WHERE d.ref_price IS NOT NULL
        AND d.ref_price > d.current_price
        AND (((d.ref_price - d.current_price)::numeric / NULLIF(d.ref_price, 0)) * 100) >= min_discount_percent
    ORDER BY discount_percentage DESC
    LIMIT limit_count;
END;
$$;

-- 4. filter_products: el orden 'discount' ahora ordena por el descuento real
--    (prices.reference vs prices.cash); sin referencia → sin descuento, al
--    final. El resto del cuerpo se mantiene idéntico al vigente.
CREATE OR REPLACE FUNCTION public.filter_products(
    p_category_slug text DEFAULT NULL::text,
    p_brand_slug text DEFAULT NULL::text,
    p_min_price integer DEFAULT NULL::integer,
    p_max_price integer DEFAULT NULL::integer,
    p_search text DEFAULT NULL::text,
    p_specs_filters jsonb DEFAULT '{}'::jsonb,
    p_sort_by text DEFAULT 'price_asc'::text,
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0
)
RETURNS TABLE(
    id uuid, name text, slug text, image_url text, specs jsonb, prices jsonb,
    brand jsonb, category jsonb, listings_count bigint, popularity_score bigint,
    mpn text, group_id uuid, created_at timestamp with time zone, total_count bigint
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
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

    -- Always filter out products with no active listings (no price)
    v_query := v_query || ' AND listings_count > 0';

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
            -- Descuento REAL: (reference - cash) / reference. Sin referencia → NULL → al final.
            v_query := v_query || ' ORDER BY ( ((prices->>''reference'')::numeric - (prices->>''cash'')::numeric) / NULLIF((prices->>''reference'')::numeric, 0) ) DESC NULLS LAST';
        WHEN 'name' THEN
            v_query := v_query || ' ORDER BY name ASC';
        WHEN 'newest' THEN
            v_query := v_query || ' ORDER BY created_at DESC';
        ELSE
            v_query := v_query || ' ORDER BY (prices->>''cash'')::int ASC';
    END CASE;

    -- Paginación
    v_query := v_query || format(' LIMIT %s OFFSET %s', p_limit, p_offset);

    -- Explicitly select columns to match RETURNS TABLE and avoid mismatch with SELECT *
    v_query := v_query || ' )
    SELECT
        id,
        name,
        slug,
        image_url,
        specs,
        prices,
        brand,
        category,
        listings_count,
        popularity_score,
        mpn,
        group_id,
        created_at,
        full_count as total_count
    FROM filtered_items;';

    RETURN QUERY EXECUTE v_query;
END;
$$;
