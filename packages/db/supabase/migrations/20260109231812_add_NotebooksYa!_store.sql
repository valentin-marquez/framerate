insert into public.stores (name, slug, url, logo_url, appearance, is_active)
values (
  'NotebooksYa!',
  'notebooksya',
  'https://notebooksya.cl',
  'https://i0.wp.com/notebooksya.cl/wp-content/uploads/2024/05/cropped-Artboard-2.png',
  'light',
  true
)
on conflict (slug) do nothing;
