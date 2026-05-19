-- =====================================================================
-- is_store_member ahora delega al modelo de accounts
-- =====================================================================
-- La autorización por tienda pasó de store_members (1:1 denormalizado) a
-- account_members (la account dueña gobierna todas sus tiendas). En vez de
-- tocar cada caller (middleware requireStoreRole/BySlug, store-reviews),
-- reimplementamos is_store_member(store_id, role) como una fachada sobre
-- is_store_account_member, preservando su firma y semántica:
--
--   role 'editor' -> puede editar metadata/assets       (account >= editor)
--   role 'owner'  -> puede gestionar miembros/la tienda  (account >= admin)
--
-- Incluye el override de admin global (ya lo hacía is_store_account_member).
-- store_members queda como tabla legacy (sin uso) hasta la fase de limpieza.
-- =====================================================================

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
declare
  v_account_role text;
begin
  -- 'owner' en la semántica vieja = gestionar miembros = admin de la account.
  v_account_role := case p_required_role
    when 'owner' then 'admin'
    when 'editor' then 'editor'
    else 'editor'
  end;

  return public.is_store_account_member(p_store_id, v_account_role);
end;
$$;

comment on function public.is_store_member(uuid, text) is
  'Fachada sobre is_store_account_member (modelo accounts). role editor->account editor; role owner->account admin. Incluye override de admin global.';

grant execute on function public.is_store_member(uuid, text) to authenticated;
