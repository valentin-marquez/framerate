-- =====================================================================
-- Fase 5 (destructiva): elimina el legacy del modelo viejo de tiendas
-- =====================================================================
-- El modelo vive en accounts/account_members + store_profiles + bucket
-- store-assets. Esta migración remueve lo que quedó sin uso:
--   - public.store_members (+ enum store_member_role)
--   - stores.owner_user_id, stores.logo_url, stores.appearance
-- get_price_drops se reescribe porque su versión previa (migración
-- 20251227215004) seleccionaba s.logo_url; ahora devuelve el path del icono
-- del bucket store-assets (icon del dueño ?? icon canónico) y la API lo
-- resuelve a URL pública. confirm_store_claim ya quedó en su forma final en
-- la migración ...060000 (no toca owner_user_id), así que acá no se redefine.
-- Auditado: ninguna vista/policy/FK/trigger depende de estos objetos;
-- is_store_member ya es fachada del modelo accounts (mig. ...050000).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. get_price_drops: store_logo_url ahora = path del bucket store-assets.
-- ---------------------------------------------------------------------
create or replace function public.get_price_drops(
  min_discount_percent double precision default 10,
  lookback_days integer default 30,
  limit_count integer default 20
)
returns table(
  product_id uuid, product_name text, product_slug text, product_image_url text,
  category_slug text, product_specs jsonb, current_price numeric, previous_price numeric,
  discount_percentage numeric, store_name text, store_logo_url text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  with cheapest_current as (
    select distinct on (l.product_id)
      l.product_id, l.store_id, l.price_cash as current_price
    from listings l
    where l.is_active = true and l.price_cash > 0
    order by l.product_id, l.price_cash asc
  ),
  drops as (
    select cc.product_id, cc.store_id, cc.current_price,
           public.f_price_reference(cc.product_id, lookback_days) as ref_price
    from cheapest_current cc
  )
  select
    p.id, p.name, p.slug, p.image_url, c.slug, p.specs,
    d.current_price::numeric,
    d.ref_price::numeric as previous_price,
    (((d.ref_price - d.current_price)::numeric / nullif(d.ref_price, 0)) * 100) as discount_percentage,
    s.name,
    coalesce(sp.icon_path, s.scraped_icon_path) as store_logo_url
  from drops d
  join products p on d.product_id = p.id
  join categories c on p.category_id = c.id
  join stores s on d.store_id = s.id
  left join store_profiles sp on sp.store_id = s.id
  where d.ref_price is not null
    and d.ref_price > d.current_price
    and (((d.ref_price - d.current_price)::numeric / nullif(d.ref_price, 0)) * 100) >= min_discount_percent
  order by discount_percentage desc
  limit limit_count;
end;
$function$;

-- ---------------------------------------------------------------------
-- 2. Drop legacy. store_members CASCADE arrastra sus policies/índices.
-- ---------------------------------------------------------------------
drop table if exists public.store_members cascade;
drop type if exists public.store_member_role;

alter table public.stores
  drop column if exists owner_user_id,
  drop column if exists logo_url,
  drop column if exists appearance;
