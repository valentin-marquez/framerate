-- =====================================================================
-- Phase 4: Cola pgmq de moderacion + RPCs.
-- =====================================================================
-- Reusamos el patron del gatekeeper (`review_queue`) y creamos una cola
-- `mod_queue` que se alimenta automaticamente con triggers sobre
-- public.reports. Las RPCs expuestas:
--
--   * get_next_mod_item()             — lee siguiente item del queue
--   * resolve_mod_report()            — resuelve un report y escribe audit
--   * flag_product_for_recheck()      — encola job de recheck al collector
-- =====================================================================

create extension if not exists pgmq;

-- Cola de moderacion (idempotente).
do $$
begin
  perform pgmq.create('mod_queue');
exception
  when others then
    raise notice 'mod_queue creation returned error (likely already exists): %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------
-- Trigger: cuando se crea un report, lo encolamos.
-- ---------------------------------------------------------------------

create or replace function public.enqueue_report_to_mod_queue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pgmq.send('mod_queue', jsonb_build_object('report_id', new.id));
  return new;
end;
$$;

drop trigger if exists reports_enqueue_trg on public.reports;
create trigger reports_enqueue_trg
  after insert on public.reports
  for each row
  execute function public.enqueue_report_to_mod_queue();

-- ---------------------------------------------------------------------
-- RPC: get_next_mod_item
-- ---------------------------------------------------------------------

create or replace function public.get_next_mod_item()
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  report_id uuid,
  target_type public.report_target_type,
  target_id uuid,
  reason public.report_reason,
  details text,
  reporter_id uuid,
  status public.report_status,
  report_created_at timestamptz,
  target_snapshot jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg record;
  v_report record;
  v_target jsonb;
begin
  -- Solo mods/admins pueden consumir el queue.
  if not public.is_moderator_or_admin() then
    raise exception 'forbidden: moderator role required';
  end if;

  -- Visibility 5 minutos, 1 mensaje.
  select * from pgmq.read('mod_queue', 300, 1) into v_msg;

  if v_msg.msg_id is null then
    return;
  end if;

  -- Recuperar report.
  select * into v_report
  from public.reports
  where id = (v_msg.message->>'report_id')::uuid;

  if v_report.id is null then
    -- Report fue eliminado; archivamos el mensaje y devolvemos vacio.
    perform pgmq.archive('mod_queue', v_msg.msg_id);
    return;
  end if;

  -- Construir snapshot del target segun tipo (best-effort).
  -- Usamos SQL dinamico porque Fase 2/3 todavia no creo `comments` ni `store_reviews`;
  -- si la tabla no existe, capturamos el error y devolvemos null para esa fila.
  v_target := null;
  begin
    case v_report.target_type
      when 'product' then
        execute format(
          'select to_jsonb(p) from %I.%I p where p.id = $1',
          'public', 'products'
        )
        into v_target
        using v_report.target_id;
      when 'comment' then
        if exists (select 1 from pg_class where relname = 'comments' and relnamespace = 'public'::regnamespace) then
          execute 'select to_jsonb(c) from public.comments c where c.id = $1'
          into v_target
          using v_report.target_id;
        end if;
      when 'store_review' then
        if exists (select 1 from pg_class where relname = 'store_reviews' and relnamespace = 'public'::regnamespace) then
          execute 'select to_jsonb(r) from public.store_reviews r where r.id = $1'
          into v_target
          using v_report.target_id;
        end if;
      when 'store' then
        if exists (select 1 from pg_class where relname = 'stores' and relnamespace = 'public'::regnamespace) then
          execute 'select to_jsonb(s) from public.stores s where s.id = $1'
          into v_target
          using v_report.target_id;
        end if;
    end case;
  exception when others then
    v_target := jsonb_build_object('error', 'failed to load target snapshot', 'message', sqlerrm);
  end;

  msg_id := v_msg.msg_id;
  read_ct := v_msg.read_ct;
  enqueued_at := v_msg.enqueued_at;
  report_id := v_report.id;
  target_type := v_report.target_type;
  target_id := v_report.target_id;
  reason := v_report.reason;
  details := v_report.details;
  reporter_id := v_report.reporter_id;
  status := v_report.status;
  report_created_at := v_report.created_at;
  target_snapshot := v_target;

  return next;
end;
$$;

revoke all on function public.get_next_mod_item() from public;
grant execute on function public.get_next_mod_item() to authenticated;

-- ---------------------------------------------------------------------
-- RPC: resolve_mod_report
-- ---------------------------------------------------------------------

create or replace function public.resolve_mod_report(
  p_msg_id bigint,
  p_report_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_new_status public.report_status;
begin
  if not public.is_moderator_or_admin() then
    raise exception 'forbidden: moderator role required';
  end if;

  if p_decision not in ('resolved', 'dismissed', 'reviewing') then
    raise exception 'invalid decision: %', p_decision;
  end if;

  v_new_status := p_decision::public.report_status;

  select to_jsonb(r) into v_before from public.reports r where r.id = p_report_id;
  if v_before is null then
    raise exception 'report not found: %', p_report_id;
  end if;

  update public.reports
  set status = v_new_status,
      resolved_by = case when v_new_status in ('resolved', 'dismissed') then v_actor else resolved_by end,
      resolved_at = case when v_new_status in ('resolved', 'dismissed') then now() else resolved_at end,
      resolution_note = coalesce(p_note, resolution_note)
  where id = p_report_id;

  select to_jsonb(r) into v_after from public.reports r where r.id = p_report_id;

  -- Audit log.
  perform public.log_mod_action(
    v_actor,
    'resolve_report',
    'report',
    p_report_id,
    p_note,
    v_before,
    v_after,
    jsonb_build_object('decision', p_decision)
  );

  -- Si el mod decidio cerrar, sacamos del queue. 'reviewing' lo dejamos visible
  -- de nuevo cuando expire el visibility timeout.
  if v_new_status in ('resolved', 'dismissed') then
    begin
      perform pgmq.archive('mod_queue', p_msg_id);
    exception when others then
      raise notice 'archive failed for msg %: %', p_msg_id, sqlerrm;
    end;
  end if;
end;
$$;

revoke all on function public.resolve_mod_report(bigint, uuid, text, text) from public;
grant execute on function public.resolve_mod_report(bigint, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Recheck queue para el collector.
-- ---------------------------------------------------------------------
-- Tabla simple que el collector puede consumir. Cualquier service-role
-- worker puede leerla y marcarla como procesada. No usamos pgmq aqui
-- para que el collector pueda consultarla con un client tipado normal.

create table if not exists public.product_recheck_queue (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  reason text,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists product_recheck_queue_status_idx
  on public.product_recheck_queue (status, requested_at);

alter table public.product_recheck_queue enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_recheck_queue' and policyname = 'product_recheck_queue_select_mod'
  ) then
    create policy product_recheck_queue_select_mod on public.product_recheck_queue
      for select to authenticated
      using (public.is_moderator_or_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- RPC: flag_product_for_recheck
-- ---------------------------------------------------------------------

create or replace function public.flag_product_for_recheck(
  p_product_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_moderator_or_admin() then
    raise exception 'forbidden: moderator role required';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'product not found: %', p_product_id;
  end if;

  insert into public.product_recheck_queue (product_id, reason, requested_by)
  values (p_product_id, p_reason, v_actor)
  returning id into v_id;

  perform public.log_mod_action(
    v_actor,
    'flag_product_for_recheck',
    'product',
    p_product_id,
    p_reason,
    null,
    null,
    jsonb_build_object('recheck_id', v_id)
  );

  return v_id;
end;
$$;

revoke all on function public.flag_product_for_recheck(uuid, text) from public;
grant execute on function public.flag_product_for_recheck(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- RPC: admin_ban_user / admin_unban_user
-- ---------------------------------------------------------------------

create or replace function public.admin_ban_user(
  p_user_id uuid,
  p_reason text default null,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin role required';
  end if;

  select to_jsonb(b) into v_before from public.user_bans b where b.user_id = p_user_id;

  insert into public.user_bans (user_id, reason, banned_by, expires_at)
  values (p_user_id, p_reason, v_actor, p_expires_at)
  on conflict (user_id) do update
    set reason = excluded.reason,
        banned_by = excluded.banned_by,
        banned_at = now(),
        expires_at = excluded.expires_at,
        lifted_at = null,
        lifted_by = null
  returning id into v_id;

  select to_jsonb(b) into v_after from public.user_bans b where b.id = v_id;

  perform public.log_mod_action(
    v_actor,
    'ban_user',
    'user',
    p_user_id,
    p_reason,
    v_before,
    v_after,
    jsonb_build_object('expires_at', p_expires_at)
  );

  return v_id;
end;
$$;

revoke all on function public.admin_ban_user(uuid, text, timestamptz) from public;
grant execute on function public.admin_ban_user(uuid, text, timestamptz) to authenticated;

create or replace function public.admin_unban_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin role required';
  end if;

  select to_jsonb(b) into v_before from public.user_bans b where b.user_id = p_user_id;
  if v_before is null then
    raise exception 'user not banned: %', p_user_id;
  end if;

  update public.user_bans
  set lifted_at = now(),
      lifted_by = v_actor
  where user_id = p_user_id
    and lifted_at is null;

  select to_jsonb(b) into v_after from public.user_bans b where b.user_id = p_user_id;

  perform public.log_mod_action(
    v_actor,
    'unban_user',
    'user',
    p_user_id,
    null,
    v_before,
    v_after,
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_unban_user(uuid) from public;
grant execute on function public.admin_unban_user(uuid) to authenticated;
