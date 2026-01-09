insert into public.stores (name, slug, url, logo_url, appearance, is_active)
values (
  'Central Gamer',
  'central-gamer',
  'https://centralgamer.cl',
  'https://i0.wp.com/centralgamer.cl/wp-content/uploads/2023/06/central-gamer-brand.png',
  'light',
  true
)
on conflict (slug) do nothing;
