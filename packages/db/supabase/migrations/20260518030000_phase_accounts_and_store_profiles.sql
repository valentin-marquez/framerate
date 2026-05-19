-- =====================================================================
-- Modelo de propiedad de tiendas: accounts + account_members + store_profiles
-- =====================================================================
-- Problema que resuelve: hoy `stores` mezcla dato canónico (escrito por el
-- scraper / migración) con dato editable por el dueño, y la propiedad es
-- 1:1 denormalizada en `stores.owner_user_id`. Una tienda no puede ser un
-- "negocio/grupo administrado por varios usuarios" ni tener varias tiendas.
--
-- Modelo objetivo:
--   account            -> la entidad dueña (negocio o grupo). Posee N tiendas.
--   account_members    -> quién la administra (gobierna TODAS sus tiendas).
--   stores.account_id  -> NULL = sembrada por migración, sin reclamar.
--   store_profiles      -> capa editable por el dueño (1:1 con store). El
--                          scraper/migración NUNCA la toca. Separación
--                          canónico/editable estructural, no por código.
--
-- Esta migración crea el esquema, los helpers de autorización (incluido
-- can_write_store_asset usado por la RLS del bucket store-assets en la
-- siguiente migración) y hace el backfill de las tiendas ya reclamadas.
-- No es destructiva: las columnas legacy (owner_user_id, description,
-- website, social, banner_url) se mantienen hasta una fase de limpieza.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum de roles a nivel account
--    owner  : control total (incl. miembros y borrar la account)
--    admin  : gestiona tiendas y miembros, no puede borrar la account
--    editor : solo edita metadata/assets de las tiendas
-- ---------------------------------------------------------------------
create type public.account_member_role as enum ('owner', 'admin', 'editor');

-- ---------------------------------------------------------------------
-- 2. accounts
-- ---------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null default 'organization' check (kind in ('organization', 'personal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.accounts is
  'Entidad dueña de una o varias tiendas (negocio/grupo). La membresía vive en account_members y gobierna todas sus tiendas.';

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. account_members
-- ---------------------------------------------------------------------
create table public.account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.account_member_role not null default 'editor',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

comment on table public.account_members is
  'Membresía de usuarios en una account. El rol aplica a TODAS las tiendas de esa account. owner > admin > editor.';

create index account_members_account_id_idx on public.account_members (account_id);
create index account_members_user_id_idx on public.account_members (user_id);

-- ---------------------------------------------------------------------
-- 4. stores: vínculo a account + path del icono canónico (bucket)
-- ---------------------------------------------------------------------
alter table public.stores
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists scraped_icon_path text;

create index if not exists stores_account_id_idx
  on public.stores (account_id)
  where account_id is not null;

comment on column public.stores.account_id is
  'Account dueña. NULL = tienda sembrada por migración, sin reclamar (is_claimed := account_id IS NOT NULL).';
comment on column public.stores.scraped_icon_path is
  'Path del icono canónico dentro del bucket store-assets (ej. "{store_id}/icon.avif"). Lo escribe solo el backfill curado / service_role, nunca el dueño.';

-- ---------------------------------------------------------------------
-- 5. store_profiles: capa editable por el dueño (1:1 con store)
--    La fila existe solo cuando la tienda se reclama/edita.
--    El render público hace COALESCE(profile.x, canónico/legacy).
-- ---------------------------------------------------------------------
create table public.store_profiles (
  store_id uuid primary key references public.stores(id) on delete cascade,
  display_name text,
  description text,
  website text,
  social jsonb not null default '{}'::jsonb,
  icon_path text,
  banner_path text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.store_profiles is
  'Capa editable por el dueño (1:1 con stores). El scraper/migración NUNCA escribe acá. icon_path/banner_path apuntan al bucket store-assets.';

drop trigger if exists store_profiles_set_updated_at on public.store_profiles;
create trigger store_profiles_set_updated_at
  before update on public.store_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Helpers de autorización (SECURITY DEFINER, search_path = '')
-- ---------------------------------------------------------------------

-- ¿auth.uid() es miembro de la account con rol >= p_required_role?
create or replace function public.is_account_member(
  p_account_id uuid,
  p_required_role text default 'editor'
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.account_member_role;
  rank_required int;
  rank_actual int;
begin
  if auth.uid() is null or p_account_id is null then
    return false;
  end if;

  select role into v_role
  from public.account_members
  where account_id = p_account_id and user_id = auth.uid();

  if v_role is null then
    return false;
  end if;

  rank_required := case p_required_role
    when 'owner' then 3
    when 'admin' then 2
    when 'editor' then 1
    else 0
  end;

  rank_actual := case v_role::text
    when 'owner' then 3
    when 'admin' then 2
    when 'editor' then 1
    else 0
  end;

  return rank_actual >= rank_required;
end;
$$;

comment on function public.is_account_member(uuid, text) is
  'true si auth.uid() es miembro de la account con rol >= p_required_role. owner > admin > editor.';

grant execute on function public.is_account_member(uuid, text) to authenticated;

-- Resuelve store -> account_id sin gatillar RLS (usado por helpers/policies).
create or replace function public.store_account_id(p_store_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select account_id from public.stores where id = p_store_id;
$$;

grant execute on function public.store_account_id(uuid) to authenticated;

-- ¿auth.uid() puede administrar la tienda (vía la account dueña) con
-- rol >= p_required_role, o es admin global? Atajo store -> account.
create or replace function public.is_store_account_member(
  p_store_id uuid,
  p_required_role text default 'editor'
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.is_account_member(public.store_account_id(p_store_id), p_required_role)
      or public.authorize('admin');
end;
$$;

comment on function public.is_store_account_member(uuid, text) is
  'true si auth.uid() administra la tienda vía su account con rol >= p_required_role, o es admin global.';

grant execute on function public.is_store_account_member(uuid, text) to authenticated;

-- Usada por la RLS del bucket store-assets (siguiente migración). Escribir
-- assets de tienda exige rol >= editor en la account dueña, o admin global.
create or replace function public.can_write_store_asset(p_store_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_store_id is null then
    return false;
  end if;
  return public.is_store_account_member(p_store_id, 'editor');
end;
$$;

comment on function public.can_write_store_asset(uuid) is
  'true si auth.uid() puede escribir assets de la tienda (rol >= editor en la account dueña o admin global). Consumida por la RLS de storage.objects del bucket store-assets.';

grant execute on function public.can_write_store_asset(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.account_members enable row level security;
alter table public.store_profiles enable row level security;

-- accounts: lectura pública (la identidad de la tienda/negocio es pública).
-- INSERT lo hace confirm_store_claim (SECURITY DEFINER); sin policy de insert
-- para usuarios normales. UPDATE/DELETE solo owner/admin de la account o
-- admin global.
create policy "accounts are publicly readable"
  on public.accounts for select
  using (true);

create policy "account admins can update account"
  on public.accounts for update
  to authenticated
  using (public.is_account_member(id, 'admin') or public.authorize('admin'))
  with check (public.is_account_member(id, 'admin') or public.authorize('admin'));

create policy "account owners can delete account"
  on public.accounts for delete
  to authenticated
  using (public.is_account_member(id, 'owner') or public.authorize('admin'));

-- account_members: lectura pública (quién administra qué). Escritura solo
-- owner/admin de la account o admin global. El bootstrap del primer owner
-- lo hace confirm_store_claim (SECURITY DEFINER).
create policy "account members are publicly readable"
  on public.account_members for select
  using (true);

create policy "account admins can add members"
  on public.account_members for insert
  to authenticated
  with check (public.is_account_member(account_id, 'admin') or public.authorize('admin'));

create policy "account admins can update members"
  on public.account_members for update
  to authenticated
  using (public.is_account_member(account_id, 'admin') or public.authorize('admin'))
  with check (public.is_account_member(account_id, 'admin') or public.authorize('admin'));

create policy "account admins can remove members"
  on public.account_members for delete
  to authenticated
  using (public.is_account_member(account_id, 'admin') or public.authorize('admin'));

-- store_profiles: lectura pública (se renderiza en el sitio). Escritura solo
-- miembros de la account dueña con rol >= editor, o admin global.
create policy "store profiles are publicly readable"
  on public.store_profiles for select
  using (true);

create policy "store editors can insert profile"
  on public.store_profiles for insert
  to authenticated
  with check (public.is_store_account_member(store_id, 'editor'));

create policy "store editors can update profile"
  on public.store_profiles for update
  to authenticated
  using (public.is_store_account_member(store_id, 'editor'))
  with check (public.is_store_account_member(store_id, 'editor'));

create policy "store admins can delete profile"
  on public.store_profiles for delete
  to authenticated
  using (public.is_store_account_member(store_id, 'admin'));

-- Sin backfill de datos: el entorno es local-only y reproducible (db reset),
-- y no hay tiendas reclamadas que migrar. Si en el futuro se hace una
-- migración real a prod con store_members/owner_user_id existentes, el
-- backfill (store_members -> account_members) se escribirá ahí con contexto
-- completo, no como maquinaria especulativa en dev.
