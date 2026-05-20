-- =====================================================================
-- Hardening del pipeline de claims (post Fase 5)
-- =====================================================================
-- Endurecemos el ciclo de vida de un claim verificado para soportar
-- re-checks periódicos confiables, freeze de escrituras cuando un claim
-- entra en stale, revoke administrativo y rate-limit del endpoint de
-- verificación. Todos los cambios son aditivos sobre el modelo de la
-- Fase accounts/store_profiles (mig. 20260518030000) y la versión final
-- de confirm_store_claim (mig. 20260518060000).
--
-- Cambios incluidos:
--   1. stores.frozen_at: timestamp de freeze cuando el TXT se cae.
--   2. can_edit_store_profile(): helper RLS que respeta el freeze.
--   3. Policies write de store_profiles consumen el helper nuevo.
--   4. claim_audit_log: bitácora inmutable de transiciones del claim.
--   5. claims_due_for_recheck: default 6h y soporta status='stale'.
--   6. process_recheck_result(): contador atómico, freeze/unfreeze y log.
--   7. admin_revoke_claim(): revoke total con limpieza de account.
--   8. record_claim_verification_attempt(): cap 50 intentos + cooldown 60s.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. stores.frozen_at
-- ---------------------------------------------------------------------
alter table public.stores
  add column if not exists frozen_at timestamptz;

comment on column public.stores.frozen_at is
  'Timestamp de cuando el claim verificado perdió el TXT y entró en stale. Bloquea writes en store_profiles vía can_edit_store_profile(). Lo limpia cortex al re-verificar OK.';

create index if not exists stores_frozen_at_idx
  on public.stores (frozen_at)
  where frozen_at is not null;

-- ---------------------------------------------------------------------
-- 2. Helper can_edit_store_profile
-- ---------------------------------------------------------------------
create or replace function public.can_edit_store_profile(
  p_store_id uuid,
  p_required_role text default 'editor'
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_frozen timestamptz;
begin
  if p_store_id is null then
    return false;
  end if;

  select frozen_at into v_frozen from public.stores where id = p_store_id;

  -- Si está congelada, sólo admin global puede editar (override de emergencia).
  if v_frozen is not null then
    return public.authorize('admin');
  end if;

  return public.is_store_account_member(p_store_id, p_required_role);
end;
$$;

grant execute on function public.can_edit_store_profile(uuid, text) to authenticated;

comment on function public.can_edit_store_profile(uuid, text) is
  'true si auth.uid() puede escribir el perfil de la tienda. Reemplaza is_store_account_member en las policies de store_profiles para respetar el freeze por stale claim.';

-- ---------------------------------------------------------------------
-- 3. Reemplazar policies de write en store_profiles
-- ---------------------------------------------------------------------
drop policy if exists "store editors can insert profile" on public.store_profiles;
drop policy if exists "store editors can update profile" on public.store_profiles;
drop policy if exists "store admins can delete profile" on public.store_profiles;

create policy "store editors can insert profile"
  on public.store_profiles for insert
  to authenticated
  with check (public.can_edit_store_profile(store_id, 'editor'));

create policy "store editors can update profile"
  on public.store_profiles for update
  to authenticated
  using (public.can_edit_store_profile(store_id, 'editor'))
  with check (public.can_edit_store_profile(store_id, 'editor'));

create policy "store admins can delete profile"
  on public.store_profiles for delete
  to authenticated
  using (public.can_edit_store_profile(store_id, 'admin'));

-- ---------------------------------------------------------------------
-- 4. Tabla claim_audit_log (append-only)
-- ---------------------------------------------------------------------
create table public.claim_audit_log (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.store_claim_requests(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  action text not null check (action in ('recheck_ok', 'stale', 'unfrozen', 'revoked')),
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.claim_audit_log is
  'Bitácora append-only de transiciones relevantes del ciclo de vida de un claim (recheck_ok, stale, unfrozen, revoked). Solo SECURITY DEFINER RPCs escriben aquí.';

create index claim_audit_log_claim_idx on public.claim_audit_log (claim_id);
create index claim_audit_log_store_idx on public.claim_audit_log (store_id);
create index claim_audit_log_created_idx on public.claim_audit_log (created_at desc);

alter table public.claim_audit_log enable row level security;

create policy "claim audit log readable by admins"
  on public.claim_audit_log for select
  to authenticated
  using (public.authorize('admin'));

-- Sin policies de write: sólo SECURITY DEFINER RPCs insertan.

-- ---------------------------------------------------------------------
-- 5. claims_due_for_recheck: default 6h, incluye status='stale'
-- ---------------------------------------------------------------------
create or replace function public.claims_due_for_recheck(p_grace interval default interval '6 hours')
returns setof public.store_claim_requests
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.store_claim_requests
  where status in ('verified', 'stale')
    and (last_checked_at is null or last_checked_at < now() - p_grace)
    and store_id is not null
  order by last_checked_at nulls first
  limit 200;
$$;

grant execute on function public.claims_due_for_recheck(interval) to service_role;

comment on function public.claims_due_for_recheck(interval) is
  'Cortex la consume cada N horas (default 6h) para revalidar TXT records. Incluye claims stale para detectar recuperaciones.';

-- ---------------------------------------------------------------------
-- 6. RPC process_recheck_result
-- ---------------------------------------------------------------------
create or replace function public.process_recheck_result(
  p_claim_id uuid,
  p_matched boolean,
  p_dns_details jsonb default null,
  p_max_failures int default 3
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.store_claim_requests%rowtype;
  v_failures int;
  v_prev_status text;
begin
  select * into v_claim
  from public.store_claim_requests
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;

  if v_claim.status not in ('verified', 'stale') then
    -- No procesamos claims pending/expired/revoked acá.
    return;
  end if;

  v_prev_status := v_claim.status;

  if p_matched then
    update public.store_claim_requests
    set last_checked_at = now(),
        status = 'verified',
        last_error = null
    where id = p_claim_id;

    if v_claim.store_id is not null then
      update public.stores
      set frozen_at = null
      where id = v_claim.store_id
        and frozen_at is not null;

      -- Log: si venía stale → unfrozen; si no, recheck_ok rutinario.
      insert into public.claim_audit_log (claim_id, store_id, action, metadata)
      values (
        p_claim_id,
        v_claim.store_id,
        case when v_prev_status = 'stale' then 'unfrozen' else 'recheck_ok' end,
        coalesce(p_dns_details, '{}'::jsonb)
      );
    end if;

    return;
  end if;

  -- Falla: incrementar contador almacenado en last_error::jsonb
  begin
    v_failures := coalesce((v_claim.last_error::jsonb ->> 'consecutive_failures')::int, 0);
  exception when others then
    v_failures := 0;
  end;
  v_failures := v_failures + 1;

  update public.store_claim_requests
  set last_checked_at = now(),
      last_error = jsonb_build_object(
        'consecutive_failures', v_failures,
        'dns', coalesce(p_dns_details, '{}'::jsonb),
        'at', now()
      )::text
  where id = p_claim_id;

  if v_failures >= p_max_failures
     and v_claim.store_id is not null
     and v_prev_status = 'verified' then
    update public.store_claim_requests
    set status = 'stale'
    where id = p_claim_id;

    update public.stores
    set frozen_at = now()
    where id = v_claim.store_id
      and frozen_at is null;

    insert into public.claim_audit_log (claim_id, store_id, action, metadata)
    values (
      p_claim_id,
      v_claim.store_id,
      'stale',
      jsonb_build_object(
        'consecutive_failures', v_failures,
        'dns', coalesce(p_dns_details, '{}'::jsonb)
      )
    );
  end if;
end;
$$;

grant execute on function public.process_recheck_result(uuid, boolean, jsonb, int) to service_role;
revoke execute on function public.process_recheck_result(uuid, boolean, jsonb, int) from anon, authenticated, public;

comment on function public.process_recheck_result(uuid, boolean, jsonb, int) is
  'Procesa resultado de re-verify del worker de cortex. Atómico: actualiza claim, maneja contador de fallos, freeze/unfreeze de stores, audit log.';

-- ---------------------------------------------------------------------
-- 7. RPC admin_revoke_claim
-- ---------------------------------------------------------------------
create or replace function public.admin_revoke_claim(
  p_claim_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.store_claim_requests%rowtype;
  v_account_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not public.authorize('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  select * into v_claim
  from public.store_claim_requests
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;

  if v_claim.store_id is not null then
    select account_id into v_account_id from public.stores where id = v_claim.store_id;

    if v_account_id is not null then
      delete from public.account_members where account_id = v_account_id;

      update public.stores
      set account_id = null,
          frozen_at = null,
          verified_at = null,
          verification_last_checked_at = null
      where id = v_claim.store_id;

      -- Decisión: limpiamos la fila para que la tienda vuelva al estado canónico.
      delete from public.store_profiles where store_id = v_claim.store_id;
    end if;
  end if;

  update public.store_claim_requests
  set status = 'revoked'
  where id = p_claim_id;

  insert into public.claim_audit_log (claim_id, store_id, action, actor_user_id, reason)
  values (p_claim_id, v_claim.store_id, 'revoked', auth.uid(), p_reason);
end;
$$;

grant execute on function public.admin_revoke_claim(uuid, text) to authenticated;
revoke execute on function public.admin_revoke_claim(uuid, text) from anon, public;

comment on function public.admin_revoke_claim(uuid, text) is
  'Admin revoke total: limpia stores.account_id, borra account_members, drop store_profiles, marca claim revoked, log de auditoría.';

-- ---------------------------------------------------------------------
-- 8. record_claim_verification_attempt: cap 50 + cooldown 60s
-- ---------------------------------------------------------------------
create or replace function public.record_claim_verification_attempt(
  p_claim_id uuid,
  p_matched boolean,
  p_dns_details jsonb default null
)
returns table (
  id uuid,
  status text,
  attempts int,
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_error text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.store_claim_requests;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into v_claim
  from public.store_claim_requests
  where store_claim_requests.id = p_claim_id;

  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_claim.claimant_user_id <> auth.uid() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if v_claim.status = 'verified' then
    return query
      select v_claim.id, v_claim.status, v_claim.attempts, v_claim.verified_at,
             v_claim.last_checked_at, v_claim.last_error;
    return;
  end if;

  if v_claim.status <> 'pending' then
    raise exception 'claim is %', v_claim.status using errcode = '22023';
  end if;

  if v_claim.expires_at < now() then
    update public.store_claim_requests
    set status = 'expired', last_checked_at = now()
    where store_claim_requests.id = p_claim_id;
    raise exception 'expired' using errcode = '22023';
  end if;

  if coalesce(v_claim.attempts, 0) >= 50 then
    raise exception 'too many attempts' using errcode = '22023';
  end if;

  if v_claim.last_checked_at is not null
     and v_claim.last_checked_at > now() - interval '60 seconds' then
    raise exception 'cooldown active, espera al menos 60s entre intentos' using errcode = '22023';
  end if;

  -- Cualificamos cada columna con store_claim_requests.* porque el `returns table`
  -- declara nombres iguales (attempts, status, verified_at) y postgres no resuelve
  -- entre la columna y el output-record sin prefijo.
  update public.store_claim_requests
  set
    attempts = coalesce(store_claim_requests.attempts, 0) + 1,
    last_checked_at = now(),
    status = case when p_matched then 'verified' else store_claim_requests.status end,
    verified_at = case when p_matched then now() else store_claim_requests.verified_at end,
    last_error = case
      when p_matched then null
      else coalesce(p_dns_details::text, 'mismatch')
    end
  where store_claim_requests.id = p_claim_id;

  return query
    select sc.id, sc.status, sc.attempts, sc.verified_at,
           sc.last_checked_at, sc.last_error
    from public.store_claim_requests sc
    where sc.id = p_claim_id;
end;
$$;

grant execute on function public.record_claim_verification_attempt(uuid, boolean, jsonb) to authenticated;
revoke execute on function public.record_claim_verification_attempt(uuid, boolean, jsonb) from anon, public;

comment on function public.record_claim_verification_attempt(uuid, boolean, jsonb) is
  'RPC SECURITY DEFINER que el claimant invoca desde el endpoint /v1/claims/:id/verify. Aplica cap de 50 intentos y cooldown de 60s antes de gastar otra ronda de DoH.';
