-- =====================================================================
-- confirm_store_claim ahora bootstrapea una account
-- =====================================================================
-- La propiedad vive en accounts/account_members. Al confirmar un claim
-- verificado se crea (idempotentemente) la account dueña, se agrega al
-- reclamante como owner de la account, se vincula stores.account_id y se
-- marca stores.verified_at (señal de "reclamada" que usa el front). No toca
-- owner_user_id ni store_members (modelo viejo, eliminado en Fase 5).
-- =====================================================================

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
  v_account_id uuid;
  v_slug text;
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
    update public.store_claim_requests set status = 'expired' where id = p_claim_id;
    raise exception 'claim has expired' using errcode = 'P0001';
  end if;

  if v_claim.store_id is null then
    raise exception 'claim has no associated store (domain not in catalog yet)' using errcode = 'P0001';
  end if;

  select * into v_store from public.stores where id = v_claim.store_id;

  -- Reusar la account si la tienda ya está vinculada; si no, crearla.
  if v_store.account_id is not null then
    v_account_id := v_store.account_id;
  else
    v_slug := v_store.slug;
    if exists (select 1 from public.accounts a where a.slug = v_slug) then
      v_slug := v_store.slug || '-' || left(v_store.id::text, 8);
    end if;

    insert into public.accounts (slug, name, kind)
    values (v_slug, v_store.name, 'organization')
    returning id into v_account_id;
  end if;

  -- Reclamante = owner de la account (idempotente).
  insert into public.account_members (account_id, user_id, role, invited_by)
  values (v_account_id, v_uid, 'owner', v_uid)
  on conflict (account_id, user_id) do update set role = 'owner';

  -- Asegurar fila de perfil editable (vacía: el render hace COALESCE).
  insert into public.store_profiles (store_id, updated_by)
  values (v_store.id, v_uid)
  on conflict (store_id) do nothing;

  update public.stores
    set account_id = v_account_id,
        verified_at = coalesce(verified_at, now()),
        verification_last_checked_at = now()
    where id = v_store.id
    returning * into v_store;

  return v_store;
end;
$$;

comment on function public.confirm_store_claim(uuid) is
  'Confirma un claim verified: crea/reusa la account dueña, agrega al reclamante como owner (account_members), vincula stores.account_id y marca verified_at. Atómico, SECURITY DEFINER.';

grant execute on function public.confirm_store_claim(uuid) to authenticated;
