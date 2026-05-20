-- =====================================================================
-- Phase 6 (destructiva): drop columnas zombi legacy en `stores`
-- =====================================================================
-- Las columnas description/website/social/banner_url quedaron sin uso
-- vivo tras la migración 20260518030000 (accounts + store_profiles).
-- A partir de ese punto, store_profiles es la única tabla editable por
-- el dueño y el render público hace COALESCE(store_profiles.*, stores.*);
-- nadie escribe nuevo en estas columnas en `stores`.
--
-- Auditado (apps/ + packages/):
--   * apps/api/src/routes/stores.ts las lee como rama legacy del
--     COALESCE en STORE_BASE_SELECT / composeStore — se rompe a propósito
--     en este PR y el orquestador limpia el SELECT post-merge.
--   * apps/api PATCH /v1/stores/:slug ESCRIBE description/website/social
--     en store_profiles (no en stores), así que dropear estas columnas
--     en stores no rompe ningún writer.
--   * apps/web consume estos campos vía el JSON de la API (StoreDetail),
--     no leyendo Supabase directo, así que el front sigue funcionando
--     mientras composeStore devuelva las keys (post-merge: null hardcoded
--     o key removida + ajuste de tipo).
--   * apps/collector, apps/tracker, apps/cortex, apps/janitor: cero
--     referencias.
--   * Sin views, indices, policies o funciones que dependan de estas
--     columnas (get_price_drops ya fue reescrita en la migración
--     20260519010000 y no las usa; confirm_store_claim tampoco).
--
-- Phase 5 (20260519010000) ya dropeó owner_user_id/logo_url/appearance;
-- esta migración completa la limpieza dropeando el resto de las columnas
-- legacy editables que ahora viven en store_profiles.
-- =====================================================================

alter table public.stores
  drop column if exists description,
  drop column if exists website,
  drop column if exists social,
  drop column if exists banner_url;
