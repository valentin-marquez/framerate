-- Vista: api_products
-- Vista optimizada para consumo de API.
-- Oculta IDs internos y timestamps, y estructura datos como objetos JSON.
CREATE OR REPLACE VIEW public.api_products AS
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
    -- Ayudantes de filtro (mantenidos en la raíz para cláusulas WHERE eficientes)
    c.slug as category_slug,
    b.slug as brand_slug,
    p.mpn
FROM
    public.products p
    JOIN public.categories c ON p.category_id = c.id
    JOIN public.brands b ON p.brand_id = b.id;

-- Otorgar acceso
GRANT SELECT ON public.api_products TO anon, authenticated, service_role;

-- Actualizar función de búsqueda para retornar la nueva estructura de vista
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

