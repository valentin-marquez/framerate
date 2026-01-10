insert into public.stores (name, slug, url, logo_url, appearance, is_active)
values (
  'Centrale',
  'centrale',
  'https://centrale.cl/',
  'https://centrale.cl/wp-content/uploads/NUEVO-LOGO-COLORES-MODERNOS.svg',
  'light',
  true
)
on conflict (slug) do nothing;
