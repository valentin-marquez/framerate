INSERT INTO public.stores (name, slug, url, logo_url, is_active)
VALUES (
    'PC Express',
    'pc-express',
    'https://tienda.pc-express.cl',
    'https://pc-express.cl/servicios/images/logo.png',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    logo_url = EXCLUDED.logo_url,
    is_active = EXCLUDED.is_active;

