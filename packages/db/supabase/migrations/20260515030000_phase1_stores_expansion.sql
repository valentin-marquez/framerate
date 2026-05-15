-- Fase 1: Expandir public.stores con metadata pública editable
--
-- Agrega columnas para descripción, sitio web (distinto del scraping url),
-- redes sociales, banner, ownership denormalizado y estado de verificación.
-- No modifica columnas existentes (name, slug, url, logo_url, is_active,
-- appearance, created_at).

alter table public.stores
  add column if not exists description text,
  add column if not exists website text,
  add column if not exists social jsonb not null default '{}'::jsonb,
  add column if not exists banner_url text,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_last_checked_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists stores_owner_user_id_idx
  on public.stores (owner_user_id)
  where owner_user_id is not null;

create index if not exists stores_verified_at_idx
  on public.stores (verified_at)
  where verified_at is not null;

comment on column public.stores.description is 'Descripción pública editable por el dueño.';
comment on column public.stores.website is 'URL pública oficial (distinta de stores.url que es la base de scraping).';
comment on column public.stores.social is 'Mapa libre de redes sociales: { twitter, instagram, facebook, ... }';
comment on column public.stores.banner_url is 'URL del banner mostrado en la página de tienda.';
comment on column public.stores.owner_user_id is 'Dueño primario denormalizado. El detalle multi-tenant vive en store_members.';
comment on column public.stores.verified_at is 'Timestamp en que la tienda fue verificada via DNS. Null = no reclamada.';
comment on column public.stores.verification_last_checked_at is 'Última re-verificación DNS exitosa o intento.';

-- Trigger genérico para mantener updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- Policies de update sobre stores: editores y owners (via is_store_member),
-- o admins globales.
drop policy if exists "Store editors can update store metadata" on public.stores;
create policy "Store editors can update store metadata"
  on public.stores
  for update
  to authenticated
  using (
    public.is_store_member(id, 'editor')
    or public.authorize('admin')
  )
  with check (
    public.is_store_member(id, 'editor')
    or public.authorize('admin')
  );
