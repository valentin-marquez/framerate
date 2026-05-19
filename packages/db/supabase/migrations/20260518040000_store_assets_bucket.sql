-- =====================================================================
-- Bucket store-assets: icono y banner de tienda alojados en Storage
-- =====================================================================
-- Reemplaza el hotlink de icon_url/logo_url/banner_url (URLs externas que se
-- rompen y no sobreviven a un re-scrape) por assets propios en Storage,
-- replicando el patrón probado de user-avatars pero scoped por membresía de
-- la account dueña (no por auth.uid()), porque varios usuarios administran
-- una tienda.
--
-- Estructura de carpeta: {store_id}/icon.<ext>  y  {store_id}/banner.<ext>
-- => (storage.foldername(name))[1] = store_id, base para la RLS.
--
-- Escritura: rol >= editor en la account dueña o admin global
--            (public.can_write_store_asset, definido en la migración previa).
-- Lectura: pública (las URLs se sirven vía el proxy /v1/images de la API).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-assets',
  'store-assets',
  true,                       -- lectura pública
  5242880,                    -- 5MB (el banner pesa más que el icono)
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura pública (mismo patrón que store-logos/product-images/user-avatars).
create policy "Public read access for store assets"
on storage.objects for select
using (bucket_id = 'store-assets');

-- Insert: miembro >= editor de la account dueña de la tienda {store_id}.
create policy "Store editors can upload store assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'store-assets'
  and public.can_write_store_asset(((storage.foldername(name))[1])::uuid)
);

-- Update: idem (upsert / reemplazo del mismo objeto).
create policy "Store editors can update store assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'store-assets'
  and public.can_write_store_asset(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'store-assets'
  and public.can_write_store_asset(((storage.foldername(name))[1])::uuid)
);

-- Delete: idem (limpieza al reemplazar un asset).
create policy "Store editors can delete store assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'store-assets'
  and public.can_write_store_asset(((storage.foldername(name))[1])::uuid)
);

-- Service role full access (backfill curado / scripts administrativos).
create policy "Service role can manage store assets"
on storage.objects for all
using (bucket_id = 'store-assets' and auth.role() = 'service_role')
with check (bucket_id = 'store-assets' and auth.role() = 'service_role');
