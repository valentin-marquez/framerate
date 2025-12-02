-- Corregir la vista products_with_prices para que respete RLS (Row Level Security)
-- Al agregar "security_invoker = true", la vista chequeará los permisos del usuario 
-- que consulta (anon/authenticated) en lugar de usar los permisos del creador de la vista.

CREATE OR REPLACE VIEW public.products_with_prices
WITH (security_invoker = true) -- <--- ESTA ES LA SOLUCIÓN
AS
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