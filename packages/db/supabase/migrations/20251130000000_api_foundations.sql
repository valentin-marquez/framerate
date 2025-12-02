-- 1. Índice GIN para filtrado de especificaciones
-- Permite consultas eficientes de la columna JSONB specs (ej. encontrar todos los productos con "socket": "AM5")
CREATE INDEX IF NOT EXISTS idx_products_specs ON public.products USING gin (specs);

-- 2. Vista: products_with_prices
-- Agrega información del producto con los precios más bajos de listados activos.
-- Esto simplifica las consultas de la API pre-calculando el "mejor precio" y uniendo tablas relacionadas.
CREATE OR REPLACE VIEW public.products_with_prices AS
SELECT
    p.id,
    p.name,
    p.slug,
    p.image_url,
    p.specs,
    p.mpn,
    p.created_at,
    p.updated_at,
    c.id as category_id,
    c.name as category_name,
    c.slug as category_slug,
    b.id as brand_id,
    b.name as brand_name,
    b.slug as brand_slug,
    g.id as group_id,
    g.name as group_name,
    (
        SELECT MIN(l.price_cash)
        FROM public.listings l
        WHERE l.product_id = p.id AND l.is_active = true
    ) as min_price_cash,
    (
        SELECT MIN(l.price_normal)
        FROM public.listings l
        WHERE l.product_id = p.id AND l.is_active = true
    ) as min_price_normal,
    (
        SELECT COUNT(*)
        FROM public.listings l
        WHERE l.product_id = p.id AND l.is_active = true
    ) as active_listings_count
FROM
    public.products p
    JOIN public.categories c ON p.category_id = c.id
    JOIN public.brands b ON p.brand_id = b.id
    LEFT JOIN public.product_groups g ON p.group_id = g.id;

-- Otorgar acceso a la vista
GRANT SELECT ON public.products_with_prices TO anon, authenticated, service_role;

-- 3. Función: search_products
-- Búsqueda de texto completo en nombre, marca, categoría y MPN.
-- Retorna filas de la vista products_with_prices.
CREATE OR REPLACE FUNCTION public.search_products(
    search_term text,
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS SETOF public.products_with_prices
LANGUAGE sql
STABLE
AS $$
    SELECT *
    FROM public.products_with_prices
    WHERE
        to_tsvector('spanish', name || ' ' || brand_name || ' ' || category_name || ' ' || COALESCE(mpn, '')) @@ plainto_tsquery('spanish', search_term)
    ORDER BY
        ts_rank(to_tsvector('spanish', name || ' ' || brand_name || ' ' || category_name || ' ' || COALESCE(mpn, '')), plainto_tsquery('spanish', search_term)) DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

-- 4. Función: get_category_filters
-- Retorna claves y valores de filtro disponibles para una categoría específica.
-- Útil para construir UI de filtros dinámicos (búsqueda facetada).
-- Ejemplo de salida: {"socket": ["AM5", "LGA1700"], "form_factor": ["ATX", "ITX"]}
CREATE OR REPLACE FUNCTION public.get_category_filters(p_category_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_object_agg(key, values)
    INTO result
    FROM (
        SELECT
            key,
            jsonb_agg(DISTINCT value ORDER BY value) as values
        FROM
            public.products p
            JOIN public.categories c ON p.category_id = c.id,
            jsonb_each_text(p.specs) as specs(key, value)
        WHERE
            c.slug = p_category_slug
        GROUP BY
            key
    ) sub;

    RETURN result;
END;
$$;

