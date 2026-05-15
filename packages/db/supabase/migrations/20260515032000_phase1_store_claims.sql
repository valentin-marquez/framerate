-- Fase 1: Reclamos de ownership de tienda via DNS TXT
--
-- Flujo: user crea claim -> recibe txt_record_name + verification_token ->
-- agrega TXT en su DNS -> POST verify (DoH a Cloudflare + Google en paralelo)
-- -> status=verified -> POST confirm (RPC) -> store_members(owner) + stores.owner_user_id

create table public.store_claim_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  claimed_domain text not null,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  verification_token text not null unique,
  txt_record_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed', 'expired', 'revoked', 'stale')),
  attempts int not null default 0,
  last_checked_at timestamptz,
  last_error text,
  verified_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

comment on table public.store_claim_requests is 'Solicitudes de claim de tienda via DNS TXT. Audit trail: filas no se borran, se marcan revoked/expired.';

-- Solo un reclamo activo (pending|verified) por dominio
create unique index store_claim_active_uniq
  on public.store_claim_requests (claimed_domain)
  where status in ('pending', 'verified');

create index store_claim_status_expires_idx
  on public.store_claim_requests (status, expires_at);

create index store_claim_claimant_idx
  on public.store_claim_requests (claimant_user_id);

create index store_claim_store_idx
  on public.store_claim_requests (store_id)
  where store_id is not null;

alter table public.store_claim_requests enable row level security;

-- Select: claimant lee los suyos; admins leen todo
create policy "Claimants can view their own claims"
  on public.store_claim_requests
  for select
  to authenticated
  using (
    claimant_user_id = (select auth.uid())
    or public.authorize('admin')
  );

-- Insert: usuario autenticado se inserta a sí mismo
create policy "Users can create their own claims"
  on public.store_claim_requests
  for insert
  to authenticated
  with check (
    claimant_user_id = (select auth.uid())
    and status = 'pending'
    and attempts = 0
    and verified_at is null
  );

-- Update: nadie via RLS (los endpoints corren con service role,
-- o usan RPCs SECURITY DEFINER). Sí permitimos al admin marcar revocado.
create policy "Admins can update claims"
  on public.store_claim_requests
  for update
  to authenticated
  using (public.authorize('admin'))
  with check (public.authorize('admin'));

-- Delete: nadie (audit trail). Ni siquiera el dueño.
-- Sin policy de delete = bloqueado por RLS.

-- RPC: confirma claim y otorga ownership atómicamente.
create or replace function public.confirm_store_claim(p_claim_id uuid)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.store_claim_requests%rowtype;
  v_store public.stores%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into v_claim
  from public.store_claim_requests
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;

  if v_claim.claimant_user_id <> v_uid then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if v_claim.status <> 'verified' then
    raise exception 'claim is not verified (status=%)', v_claim.status using errcode = 'P0001';
  end if;

  if v_claim.expires_at < now() then
    update public.store_claim_requests
      set status = 'expired'
      where id = p_claim_id;
    raise exception 'claim has expired' using errcode = 'P0001';
  end if;

  if v_claim.store_id is null then
    raise exception 'claim has no associated store (domain not in catalog yet)' using errcode = 'P0001';
  end if;

  -- Evitar doble confirm: si la store ya tiene owner del mismo claim, devolver tal cual.
  select * into v_store from public.stores where id = v_claim.store_id;

  -- Insertar membresía como owner (idempotente)
  insert into public.store_members (store_id, user_id, role, invited_by)
  values (v_claim.store_id, v_uid, 'owner', v_uid)
  on conflict (store_id, user_id) do update
    set role = 'owner';

  -- Actualizar ownership denormalizado y verified_at en stores
  update public.stores
    set owner_user_id = v_uid,
        verified_at = coalesce(verified_at, now()),
        verification_last_checked_at = now()
    where id = v_claim.store_id
    returning * into v_store;

  return v_store;
end;
$$;

comment on function public.confirm_store_claim(uuid) is
  'Confirma un claim verified: crea store_members(owner) y actualiza stores.owner_user_id. Atómico, SECURITY DEFINER.';

grant execute on function public.confirm_store_claim(uuid) to authenticated;

-- Función helper para re-verificación periódica.
-- Devuelve claims verificados cuya última revisión es vieja, para que
-- cortex haga DoH nuevamente. El caller (service role) actualiza el resultado.
create or replace function public.claims_due_for_recheck(p_grace interval default interval '7 days')
returns setof public.store_claim_requests
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.store_claim_requests
  where status = 'verified'
    and (last_checked_at is null or last_checked_at < now() - p_grace)
  order by last_checked_at nulls first
  limit 200;
$$;

comment on function public.claims_due_for_recheck(interval) is
  'Cortex la consume cada N horas para revalidar TXT records. Si falla 3 veces marca el claim/store como stale.';

grant execute on function public.claims_due_for_recheck(interval) to service_role;
