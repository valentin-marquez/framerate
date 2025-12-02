-- Actualizar Vista: api_products
-- Se agregó group_id para permitir obtener variantes.

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
    p.mpn,
    p.group_id
FROM
    public.products p
    JOIN public.categories c ON p.category_id = c.id
    JOIN public.brands b ON p.brand_id = b.id;

-- Otorgar acceso
GRANT SELECT ON public.api_products TO anon, authenticated, service_role;

