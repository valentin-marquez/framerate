INSERT INTO public.stores (name, slug, url, logo_url, is_active)
VALUES (
    'MyShop',
    'myshop',
    'https://www.myshop.cl',
    'https://static.myshop.cl/logoheader/808321.webp',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    logo_url = EXCLUDED.logo_url,
    is_active = EXCLUDED.is_active;
