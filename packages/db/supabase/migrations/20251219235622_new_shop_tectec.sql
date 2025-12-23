INSERT INTO public.stores (name, slug, url, logo_url, is_active)
VALUES (
    'TecTec',
    'tectec',
    'https://tectec.cl',
    'https://tectec.cl/wp-content/uploads/2024/04/TecTec_500x500.png.webp',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    logo_url = EXCLUDED.logo_url,
    is_active = EXCLUDED.is_active;
