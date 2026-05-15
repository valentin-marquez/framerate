-- =====================================================================
-- Phase 0: Foundation del sistema de roles
-- =====================================================================
-- Esta migración crea:
--   1. El enum public.user_role ('user', 'moderator', 'admin')
--   2. La tabla public.user_roles (pivot user <-> role) con RLS
--   3. El helper public.authorize(text) que lee el claim 'user_role' del JWT
--   4. El stub public.is_store_member(uuid, text) — placeholder para Fase 1
--   5. El custom access token hook que inyecta el rol como claim del JWT
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------
create type public.user_role as enum ('user', 'moderator', 'admin');

-- ---------------------------------------------------------------------
-- 2. Helper authorize() — DEBE existir antes de las policies que lo usan
--    Lee el claim 'user_role' inyectado por el custom_access_token_hook.
--    security definer + search_path='' para evitar el warning
--    "function search path mutable" de Supabase.
-- ---------------------------------------------------------------------
create or replace function public.authorize(required_role text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current_role text;
  rank_required int;
  rank_current int;
begin
  v_current_role := coalesce(
    (auth.jwt() ->> 'user_role'),
    'user'
  );

  rank_required := case required_role
    when 'admin' then 3
    when 'moderator' then 2
    when 'user' then 1
    else 0
  end;

  rank_current := case v_current_role
    when 'admin' then 3
    when 'moderator' then 2
    when 'user' then 1
    else 0
  end;

  return rank_current >= rank_required;
end;
$$;

comment on function public.authorize(text) is
  'Devuelve true si el JWT actual tiene un rol >= required_role. Lee el claim user_role inyectado por custom_access_token_hook.';

-- ---------------------------------------------------------------------
-- 3. Stub is_store_member() — placeholder para Fase 1.
--    La Fase 1 reemplaza esta función con la versión real (consulta
--    contra la tabla store_members que todavía no existe).
-- ---------------------------------------------------------------------
create or replace function public.is_store_member(
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
  -- Stub: Fase 1 implementa la lógica real contra store_members.
  return false;
end;
$$;

comment on function public.is_store_member(uuid, text) is
  'STUB Fase 0: siempre devuelve false. Fase 1 reemplaza con la implementación real.';

-- ---------------------------------------------------------------------
-- 4. Tabla user_roles
-- ---------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  unique (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles(user_id);

comment on table public.user_roles is
  'Roles globales asignados a usuarios. Un usuario puede tener varios roles. El custom_access_token_hook expone el rol más alto como claim user_role en el JWT.';

-- ---------------------------------------------------------------------
-- 5. RLS para user_roles
-- ---------------------------------------------------------------------
alter table public.user_roles enable row level security;

-- Cada user puede leer sus propios roles
create policy "users read own roles" on public.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Admins pueden leer todos los roles
create policy "admins read all roles" on public.user_roles
  for select
  to authenticated
  using (public.authorize('admin'));

-- Solo admins pueden escribir (insert/update/delete) roles
create policy "admins insert roles" on public.user_roles
  for insert
  to authenticated
  with check (public.authorize('admin'));

create policy "admins update roles" on public.user_roles
  for update
  to authenticated
  using (public.authorize('admin'))
  with check (public.authorize('admin'));

create policy "admins delete roles" on public.user_roles
  for delete
  to authenticated
  using (public.authorize('admin'));

-- ---------------------------------------------------------------------
-- 6. Custom Access Token Hook
--    Supabase Auth invoca esta función cada vez que emite un JWT.
--    Lee user_roles del usuario y agrega:
--      - claims.user_role: rol más alto (string)
--      - claims.user_roles: array con todos los roles (text[])
-- ---------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  user_roles_arr text[];
  highest_role text;
begin
  claims := event -> 'claims';

  select array_agg(role::text order by
    case role::text
      when 'admin' then 1
      when 'moderator' then 2
      when 'user' then 3
      else 4
    end
  )
  into user_roles_arr
  from public.user_roles
  where user_id = (event ->> 'user_id')::uuid;

  if user_roles_arr is null or array_length(user_roles_arr, 1) = 0 then
    highest_role := 'user';
    user_roles_arr := array['user']::text[];
  else
    highest_role := user_roles_arr[1];
  end if;

  claims := jsonb_set(claims, '{user_role}', to_jsonb(highest_role));
  claims := jsonb_set(claims, '{user_roles}', to_jsonb(user_roles_arr));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Inyecta user_role (rol más alto) y user_roles (array) como claims del JWT. Configurado en supabase/config.toml bajo [auth.hook.custom_access_token].';

-- ---------------------------------------------------------------------
-- 7. Grants para que Supabase Auth pueda ejecutar el hook
--    El hook corre como supabase_auth_admin y necesita leer user_roles.
-- ---------------------------------------------------------------------
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant all on table public.user_roles to supabase_auth_admin;

revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Política dedicada para que supabase_auth_admin pueda leer user_roles
-- sin chocar con RLS (necesario porque la tabla tiene RLS habilitada).
create policy "supabase_auth_admin reads user_roles" on public.user_roles
  for select
  to supabase_auth_admin
  using (true);
