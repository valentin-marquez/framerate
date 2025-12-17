-- Corregir search_products para fijar el search_path
-- Se agrega "SET search_path = public" para evitar hijacking de esquemas.
CREATE OR REPLACE FUNCTION public.search_products(
    search_term text,
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS SETOF public.products_with_prices
LANGUAGE sql
STABLE
SET search_path = public -- <--- ESTA ES LA CORRECCIÓN
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
-- Corregir get_category_filters para fijar el search_path
-- Se agrega "SET search_path = public" para evitar hijacking de esquemas.
CREATE OR REPLACE FUNCTION public.get_category_filters(p_category_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public -- <--- ESTA ES LA CORRECCIÓN
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
