INSERT INTO public.stores (name, slug, url, logo_url, is_active)
VALUES (
    'SP Digital',
    'sp-digital',
    'https://www.spdigital.cl',
    'https://i.imgur.com/1enXHY8.png',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    logo_url = EXCLUDED.logo_url,
    is_active = EXCLUDED.is_active;

