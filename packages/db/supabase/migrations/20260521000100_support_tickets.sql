-- =====================================================================
-- Support tickets: formulario de contacto integrado en la plataforma
-- =====================================================================
-- Reemplaza el mailto: anterior. Permite:
--   * Usuarios logueados crean tickets vinculados a su cuenta.
--   * Visitantes anónimos crean tickets vía service role del API tras
--     validar Cloudflare Turnstile (anon NO puede insertar vía RLS).
--   * Mods/admins responden en hilo y cambian estados.
--   * Mensajes internos (is_internal_note) visibles sólo entre staff.
--
-- Depende de helpers de Fase 4: public.is_moderator_or_admin(),
-- public.is_admin(), public.is_user_banned(uuid).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_type where typname = 'support_category') then
    create type public.support_category as enum (
      'privacy',         -- consultas/derechos ARCO (acceso, rectificación, cancelación, oposición)
      'data_request',    -- solicitudes de eliminación o exportación de datos
      'abuse_report',    -- abuso/contenido no apropiado fuera del flujo de reports
      'store_issue',     -- problemas con una tienda reclamada o reclamo en curso
      'bug',             -- bugs técnicos
      'feature',         -- sugerencias / pedidos
      'other'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'support_status') then
    create type public.support_status as enum (
      'open',            -- recién creado, sin staff asignado
      'in_progress',     -- staff lo está atendiendo
      'waiting_user',    -- staff respondió, esperando al usuario
      'resolved',        -- staff lo cerró como resuelto
      'closed'           -- archivado (admin) o cerrado por el usuario
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Tabla support_tickets
-- ---------------------------------------------------------------------

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  -- email snapshot (del usuario logueado al crear, o del anon). Permite
  -- responder fuera de plataforma si fuera necesario y sobrevive a la
  -- baja de cuenta.
  email text not null check (char_length(email) between 3 and 320),
  category public.support_category not null,
  subject text not null check (char_length(subject) between 3 and 200),
  body text not null check (char_length(body) between 10 and 5000),
  status public.support_status not null default 'open',
  assigned_to uuid references auth.users(id) on delete set null,
  -- Origen: 'web' (form principal), 'system' (creado por un trigger interno).
  source text not null default 'web' check (source in ('web', 'api', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id, created_at desc)
  where user_id is not null;

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, last_message_at desc);

create index if not exists support_tickets_assigned_idx
  on public.support_tickets (assigned_to, status)
  where assigned_to is not null;

create index if not exists support_tickets_category_idx
  on public.support_tickets (category, status);

alter table public.support_tickets enable row level security;

-- SELECT: dueño o staff.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'support_tickets' and policyname = 'support_tickets_select_self_or_staff'
  ) then
    create policy support_tickets_select_self_or_staff on public.support_tickets
      for select to authenticated
      using (
        (user_id is not null and user_id = (select auth.uid()))
        or public.is_moderator_or_admin()
      );
  end if;
end $$;

-- INSERT: usuario autenticado, su propio user_id, no baneado.
-- (Tickets anónimos se insertan con service role bypass.)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'support_tickets' and policyname = 'support_tickets_insert_self'
  ) then
    create policy support_tickets_insert_self on public.support_tickets
      for insert to authenticated
      with check (
        user_id = (select auth.uid())
        and not public.is_user_banned((select auth.uid()))
      );
  end if;
end $$;

-- UPDATE: sólo staff (cambios de status, assigned_to, etc).
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'support_tickets' and policyname = 'support_tickets_update_staff'
  ) then
    create policy support_tickets_update_staff on public.support_tickets
      for update to authenticated
      using (public.is_moderator_or_admin())
      with check (public.is_moderator_or_admin());
  end if;
end $$;

-- DELETE: sólo admin (caso excepcional, p.ej. dato personal de un anon).
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'support_tickets' and policyname = 'support_tickets_delete_admin'
  ) then
    create policy support_tickets_delete_admin on public.support_tickets
      for delete to authenticated
      using (public.is_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Tabla support_ticket_messages
-- ---------------------------------------------------------------------

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  -- 'user' = dueño del ticket; 'staff' = mod/admin; 'system' = mensajes automáticos.
  author_role text not null check (author_role in ('user', 'staff', 'system')),
  body text not null check (char_length(body) between 1 and 5000),
  -- Notas privadas entre staff (no las ve el usuario).
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_ticket_messages enable row level security;

-- SELECT: staff ve todo; dueño del ticket ve mensajes no-internos de su ticket.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'support_ticket_messages' and policyname = 'support_messages_select_self_or_staff'
  ) then
    create policy support_messages_select_self_or_staff on public.support_ticket_messages
      for select to authenticated
      using (
        public.is_moderator_or_admin()
        or (
          is_internal_note = false
          and exists (
            select 1 from public.support_tickets t
            where t.id = ticket_id and t.user_id = (select auth.uid())
          )
        )
      );
  end if;
end $$;

-- INSERT: staff puede responder cualquier ticket y marcar interno;
-- usuario sólo puede responder a sus propios tickets, no-internos.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'support_ticket_messages' and policyname = 'support_messages_insert'
  ) then
    create policy support_messages_insert on public.support_ticket_messages
      for insert to authenticated
      with check (
        author_id = (select auth.uid())
        and not public.is_user_banned((select auth.uid()))
        and (
          (
            public.is_moderator_or_admin()
            and author_role = 'staff'
          )
          or (
            author_role = 'user'
            and is_internal_note = false
            and exists (
              select 1 from public.support_tickets t
              where t.id = ticket_id
                and t.user_id = (select auth.uid())
                and t.status not in ('closed', 'resolved')
            )
          )
        )
      );
  end if;
end $$;

-- UPDATE/DELETE: no permitido vía RLS. Si hace falta editar, se usa service role.

-- ---------------------------------------------------------------------
-- Trigger: updated_at + last_message_at del ticket
-- ---------------------------------------------------------------------

create or replace function public.touch_support_ticket_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.touch_support_ticket_updated_at();

create or replace function public.bump_support_ticket_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_tickets
     set last_message_at = new.created_at,
         updated_at = now(),
         -- Si responde staff y el ticket estaba 'open', lo movemos a 'in_progress' o 'waiting_user'.
         status = case
           when new.author_role = 'staff' and new.is_internal_note = false and status in ('open', 'in_progress') then 'waiting_user'::public.support_status
           when new.author_role = 'user' and status = 'waiting_user' then 'in_progress'::public.support_status
           else status
         end
   where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_messages_bump_ticket on public.support_ticket_messages;
create trigger support_messages_bump_ticket
  after insert on public.support_ticket_messages
  for each row execute function public.bump_support_ticket_on_message();

-- ---------------------------------------------------------------------
-- RPC: create_support_ticket_anonymous (service role only)
-- ---------------------------------------------------------------------
-- Permite al API insertar tickets de visitantes anónimos tras validar
-- Turnstile. Devuelve el id del ticket creado.

create or replace function public.create_support_ticket_anonymous(
  p_email text,
  p_category public.support_category,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.support_tickets (
    user_id, email, category, subject, body, source
  ) values (
    null, p_email, p_category, p_subject, p_body, 'web'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_support_ticket_anonymous(text, public.support_category, text, text) from public, anon, authenticated;
grant execute on function public.create_support_ticket_anonymous(text, public.support_category, text, text) to service_role;

comment on function public.create_support_ticket_anonymous(text, public.support_category, text, text) is
  'Inserta un ticket de soporte sin user_id. Sólo callable por service_role (API tras validar Turnstile).';

-- ---------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------

comment on table public.support_tickets is
  'Tickets del formulario de contacto integrado. Anon vía service role tras Turnstile; logueados directo con RLS.';
comment on table public.support_ticket_messages is
  'Mensajes del hilo de un ticket. is_internal_note se filtra a usuarios; staff ve todo.';
