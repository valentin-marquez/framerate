-- Optimización de búsqueda de texto completo (Full-Text Search)
-- Agrega índices GIN para mejorar el rendimiento de búsquedas en productos

-- 1. Agregar columna tsvector para búsqueda pre-computada
-- Esto mejora significativamente el rendimiento al no tener que generar el vector en cada búsqueda
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector(
    'spanish',
    COALESCE(name, '') || ' ' ||
    COALESCE(mpn, '')
  )
) STORED;

-- 2. Crear índice GIN en el vector de búsqueda
-- GIN (Generalized Inverted Index) es ideal para búsquedas de texto completo
CREATE INDEX IF NOT EXISTS idx_products_search_vector
ON public.products USING gin(search_vector);

-- 3. Índice adicional para búsquedas por marca (usado frecuentemente)
CREATE INDEX IF NOT EXISTS idx_products_brand_id
ON public.products(brand_id)
WHERE brand_id IS NOT NULL;

-- 4. Índice para búsquedas por categoría (usado frecuentemente)
CREATE INDEX IF NOT EXISTS idx_products_category_id
ON public.products(category_id)
WHERE category_id IS NOT NULL;

-- 5. Índice compuesto para filtros comunes de precio + categoría
CREATE INDEX IF NOT EXISTS idx_products_category_price
ON public.products(category_id, id)
WHERE category_id IS NOT NULL;

-- 6. Actualizar la función search_products para usar el nuevo índice
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
        -- Usa el índice GIN pre-computado para búsqueda rápida
        p.search_vector @@ plainto_tsquery('spanish', search_term)
        OR
        -- Fallback para búsqueda en marca y categoría desde la vista
        to_tsvector('spanish', pwp.brand_name || ' ' || pwp.category_name) @@ plainto_tsquery('spanish', search_term)
    ORDER BY
        -- Ranking por relevancia usando el vector pre-computado
        ts_rank(p.search_vector, plainto_tsquery('spanish', search_term)) DESC,
        pwp.min_price_cash ASC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
$$;

-- 7. Crear función auxiliar para búsqueda liviana (solo nombres y conteo)
-- Ideal para autocomplete/live search con mínima carga
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
        COALESCE(
            (
                SELECT MIN(l.price_cash)
                FROM public.listings l
                WHERE l.product_id = p.id AND l.is_active = true
            ),
            0
        ) as current_price,
        p.image_url,
        ts_rank(p.search_vector, plainto_tsquery('spanish', search_term)) as rank
    FROM public.products p
    LEFT JOIN public.brands b ON p.brand_id = b.id
    LEFT JOIN public.categories c ON p.category_id = c.id
    WHERE
        p.search_vector @@ plainto_tsquery('spanish', search_term)
    ORDER BY
        rank DESC,
        current_price ASC
    LIMIT p_limit;
$$;

-- 8. Agregar política RLS para la nueva función
ALTER FUNCTION public.quick_search_products(text, int) SECURITY DEFINER;

-- 9. Comentarios para documentación
COMMENT ON COLUMN public.products.search_vector IS 'Vector de búsqueda pre-computado para optimizar full-text search';
COMMENT ON INDEX idx_products_search_vector IS 'Índice GIN para búsqueda de texto completo optimizada';
COMMENT ON FUNCTION public.quick_search_products IS 'Búsqueda rápida para autocomplete y live search con datos mínimos';
