-- =====================================================================
-- Phase 4: Moderation tooling + reports system
-- =====================================================================
-- Crea las tablas base para reportar contenido por parte de los usuarios,
-- registrar acciones de moderación (audit log append-only) y banear users.
--
-- Notas:
--   * Las migraciones de Fase 0 (user_roles + authorize helper) podrian
--     no estar todavia en el branch base. Para que esta migracion sea
--     idempotente y no rompa los apps, definimos un helper local
--     `public.is_moderator_or_admin()` que consulta `user_roles` si
--     existe y, en caso contrario, devuelve `false`. Cuando Fase 0
--     llegue al merge final, este helper queda como wrapper inocuo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de roles (compatibles con Fase 0 o sin ella).
-- ---------------------------------------------------------------------

-- Asegura que exista un enum public.user_role minimo (idempotente).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('user', 'moderator', 'admin');
  end if;
end;
$$;

-- Tabla user_roles minima si Fase 0 todavia no la creo.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'user',
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- Solo lecturas propias + admins/mods.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_roles' and policyname = 'user_roles_select_self'
  ) then
    create policy user_roles_select_self on public.user_roles
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end $$;

-- Helper: verifica si el usuario actual es mod o admin.
create or replace function public.is_moderator_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select ur.role in ('moderator', 'admin')
      from public.user_roles ur
      where ur.user_id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select ur.role = 'admin'
      from public.user_roles ur
      where ur.user_id = auth.uid()
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- Enums para reports.
-- ---------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_type where typname = 'report_target_type') then
    create type public.report_target_type as enum ('product', 'comment', 'store_review', 'store');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'report_reason') then
    create type public.report_reason as enum (
      'spam',
      'harassment',
      'misleading',
      'duplicate',
      'wrong_listing',
      'broken_link',
      'inappropriate',
      'other'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Tabla user_bans (necesaria antes que reports por la FK logica del helper).
-- ---------------------------------------------------------------------

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  reason text,
  banned_by uuid references auth.users(id) on delete set null,
  banned_at timestamptz not null default now(),
  expires_at timestamptz,
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id) on delete set null
);

create index if not exists user_bans_active_idx
  on public.user_bans (user_id)
  where lifted_at is null;

alter table public.user_bans enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_bans' and policyname = 'user_bans_select_self_or_mod'
  ) then
    create policy user_bans_select_self_or_mod on public.user_bans
      for select to authenticated
      using (user_id = (select auth.uid()) or public.is_moderator_or_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_bans' and policyname = 'user_bans_admin_insert'
  ) then
    create policy user_bans_admin_insert on public.user_bans
      for insert to authenticated
      with check (public.is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_bans' and policyname = 'user_bans_admin_update'
  ) then
    create policy user_bans_admin_update on public.user_bans
      for update to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Helper que Fase 2/3 puede consultar antes de permitir inserts.
-- Definido despues de user_bans para que la referencia compile.
create or replace function public.is_user_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_bans b
    where b.user_id = p_user_id
      and b.lifted_at is null
      and (b.expires_at is null or b.expires_at > now())
  );
$$;

-- ---------------------------------------------------------------------
-- Tabla reports.
-- ---------------------------------------------------------------------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type public.report_target_type not null,
  target_id uuid not null,
  reporter_id uuid references auth.users(id) on delete set null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter_id);

-- Anti-spam: un mismo reporter no puede tener mas de 1 report 'open' sobre el mismo target.
create unique index if not exists reports_unique_open
  on public.reports (target_type, target_id, reporter_id)
  where status = 'open';

alter table public.reports enable row level security;

-- Select: reporter propio o mod/admin.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_select_self_or_mod'
  ) then
    create policy reports_select_self_or_mod on public.reports
      for select to authenticated
      using (reporter_id = (select auth.uid()) or public.is_moderator_or_admin());
  end if;
end $$;

-- Insert: cualquier user logueado, con su propio reporter_id, no baneado.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_insert_self'
  ) then
    create policy reports_insert_self on public.reports
      for insert to authenticated
      with check (
        reporter_id = (select auth.uid())
        and not public.is_user_banned((select auth.uid()))
      );
  end if;
end $$;

-- Update: solo mod/admin (resolver, dismiss).
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_update_mod'
  ) then
    create policy reports_update_mod on public.reports
      for update to authenticated
      using (public.is_moderator_or_admin())
      with check (public.is_moderator_or_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Tabla mod_actions (audit log append-only).
-- ---------------------------------------------------------------------

create table if not exists public.mod_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mod_actions_actor_idx on public.mod_actions (actor_id, created_at desc);
create index if not exists mod_actions_target_idx on public.mod_actions (target_type, target_id, created_at desc);
create index if not exists mod_actions_action_idx on public.mod_actions (action, created_at desc);

alter table public.mod_actions enable row level security;

-- Select: solo mod/admin.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mod_actions' and policyname = 'mod_actions_select_mod'
  ) then
    create policy mod_actions_select_mod on public.mod_actions
      for select to authenticated
      using (public.is_moderator_or_admin());
  end if;
end $$;

-- Insert/update/delete: bloqueado para clientes. Solo via SECURITY DEFINER functions.
-- (No creamos policy de insert para authenticated; el rol service_role bypassea RLS.)

-- ---------------------------------------------------------------------
-- Helper: registrar accion de moderacion desde funciones SECURITY DEFINER.
-- ---------------------------------------------------------------------

create or replace function public.log_mod_action(
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_reason text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.mod_actions (
    actor_id, action, target_type, target_id, reason, before_snapshot, after_snapshot, metadata
  ) values (
    p_actor_id, p_action, p_target_type, p_target_id, p_reason, p_before, p_after, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_mod_action(uuid, text, text, uuid, text, jsonb, jsonb, jsonb) from public;
