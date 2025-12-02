INSERT INTO public.stores (name, slug, url, logo_url, is_active)
VALUES (
    'Eylstore',
    'eylstore',
    'https://www.eylstore.cl',
    'https://www.eylstore.cl/EYL_Logo%20Horizontal.webp',
    true
)
ON CONFLICT (name) DO UPDATE SET
    url = EXCLUDED.url,
    logo_url = EXCLUDED.logo_url,
    is_active = EXCLUDED.is_active;

