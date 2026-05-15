-- =====================================================================
-- Fix: permitir que el claimant actualice su propio claim via RPC seguro.
-- =====================================================================
-- El endpoint POST /v1/claims/:id/verify corre con el JWT del usuario y
-- la policy UPDATE sobre store_claim_requests solo permite service_role,
-- por lo que el update queda bloqueado. Solución: RPC SECURITY DEFINER
-- que valida auth.uid() = claimant_user_id antes de hacer el update.
-- Preserva la trust boundary (api sigue usando anon key + JWT del user).
-- =====================================================================

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
    -- idempotente: ya verificado
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
    set status = 'expired',
        last_checked_at = now()
    where store_claim_requests.id = p_claim_id;
    raise exception 'expired' using errcode = '22023';
  end if;

  update public.store_claim_requests
  set
    attempts = coalesce(attempts, 0) + 1,
    last_checked_at = now(),
    status = case when p_matched then 'verified' else status end,
    verified_at = case when p_matched then now() else verified_at end,
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
