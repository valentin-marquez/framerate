-- Fase 1: store_members (multi-tenant ownership)
--
-- Un usuario puede pertenecer a varias tiendas con distintos roles.
-- 'owner' puede gestionar miembros y metadata; 'editor' solo metadata.
-- La verificación efectiva pasa por public.is_store_member(p_store_id, p_role).

create type public.store_member_role as enum ('owner', 'editor');

create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.store_member_role not null default 'editor',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

comment on table public.store_members is 'Membresía multi-tenant de usuarios en tiendas. Roles: owner (full control), editor (metadata).';

create index store_members_store_id_idx on public.store_members (store_id);
create index store_members_user_id_idx on public.store_members (user_id);

alter table public.store_members enable row level security;

-- Lectura pública: cualquiera puede ver quién gestiona qué tienda.
create policy "Store members are publicly readable"
  on public.store_members
  for select
  using (true);

-- Insert: solo owners de la tienda o admins. El RPC confirm_store_claim
-- (SECURITY DEFINER) hace el bootstrap del primer owner.
create policy "Owners can add store members"
  on public.store_members
  for insert
  to authenticated
  with check (
    public.is_store_member(store_id, 'owner')
    or public.authorize('admin')
  );

-- Update: solo owners o admins
create policy "Owners can update store members"
  on public.store_members
  for update
  to authenticated
  using (
    public.is_store_member(store_id, 'owner')
    or public.authorize('admin')
  )
  with check (
    public.is_store_member(store_id, 'owner')
    or public.authorize('admin')
  );

-- Delete: solo owners o admins
create policy "Owners can remove store members"
  on public.store_members
  for delete
  to authenticated
  using (
    public.is_store_member(store_id, 'owner')
    or public.authorize('admin')
  );

-- Reemplazar el stub de Fase 0 con la implementación real.
create or replace function public.is_store_member(p_store_id uuid, p_required_role text default 'editor')
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role public.store_member_role;
  rank_required int;
  rank_actual int;
begin
  if auth.uid() is null then
    return false;
  end if;

  select role into v_role
  from public.store_members
  where store_id = p_store_id and user_id = auth.uid();

  if v_role is null then
    return false;
  end if;

  rank_required := case p_required_role
    when 'owner' then 2
    when 'editor' then 1
    else 0
  end;

  rank_actual := case v_role::text
    when 'owner' then 2
    when 'editor' then 1
    else 0
  end;

  return rank_actual >= rank_required;
end;
$$;

comment on function public.is_store_member(uuid, text) is
  'Devuelve true si auth.uid() es miembro de la tienda con rol >= p_required_role. owner > editor.';

grant execute on function public.is_store_member(uuid, text) to authenticated;
