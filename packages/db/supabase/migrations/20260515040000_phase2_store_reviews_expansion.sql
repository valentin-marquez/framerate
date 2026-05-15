-- =============================================================================
-- Fase 2: Expansión de store_reviews + helpful votes + soft delete + owner response
-- =============================================================================
-- Asume Fase 0 (user_roles, authorize, is_store_member) ya aplicada.
-- Asume que Fase 1 reemplazará el stub `is_store_member` con la implementación
-- real (consulta a `store_members`). Las policies de abajo dependen de eso pero
-- son compatibles con el stub (mientras `store_members` no exista, retorna false
-- y nadie de la tienda puede editar respuesta; admin/mod siguen funcionando).

-- =============================================================================
-- 1) Expansión de columnas en store_reviews
-- =============================================================================

alter table public.store_reviews
  add column if not exists helpful_count int not null default 0,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists owner_response text,
  add column if not exists owner_response_at timestamptz,
  add column if not exists owner_response_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_reason text;

-- Constraints de longitud
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'store_reviews_comment_length_check'
  ) then
    alter table public.store_reviews
      add constraint store_reviews_comment_length_check
      check (comment is null or char_length(comment) <= 2000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'store_reviews_owner_response_length_check'
  ) then
    alter table public.store_reviews
      add constraint store_reviews_owner_response_length_check
      check (owner_response is null or char_length(owner_response) <= 1000);
  end if;
end $$;

-- Índice para listar reviews no borradas + ordenadas por helpful_count
create index if not exists idx_store_reviews_store_active
  on public.store_reviews (store_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_store_reviews_store_helpful
  on public.store_reviews (store_id, helpful_count desc, created_at desc)
  where deleted_at is null;

-- =============================================================================
-- 2) Tabla store_review_helpful (votos de "útil")
-- =============================================================================

create table if not exists public.store_review_helpful (
  review_id uuid not null references public.store_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists idx_store_review_helpful_user
  on public.store_review_helpful (user_id);

alter table public.store_review_helpful enable row level security;

-- Lectura pública para mostrar quién marcó útil (o al menos contar)
drop policy if exists "Public store_review_helpful viewable" on public.store_review_helpful;
create policy "Public store_review_helpful viewable"
  on public.store_review_helpful
  for select
  using (true);

-- Solo el dueño del voto puede insertarlo
drop policy if exists "Users can vote helpful" on public.store_review_helpful;
create policy "Users can vote helpful"
  on public.store_review_helpful
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Solo el dueño puede retirar su voto
drop policy if exists "Users can remove their helpful vote" on public.store_review_helpful;
create policy "Users can remove their helpful vote"
  on public.store_review_helpful
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- =============================================================================
-- 3) Trigger para mantener helpful_count consistente
-- =============================================================================

create or replace function public.update_store_review_helpful_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    update public.store_reviews
      set helpful_count = helpful_count + 1
      where id = new.review_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.store_reviews
      set helpful_count = greatest(helpful_count - 1, 0)
      where id = old.review_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists store_review_helpful_count_trg on public.store_review_helpful;
create trigger store_review_helpful_count_trg
  after insert or delete on public.store_review_helpful
  for each row execute function public.update_store_review_helpful_count();

-- =============================================================================
-- 4) Policies adicionales sobre store_reviews
-- =============================================================================
-- La policy original "Users can update their own store reviews" se mantiene
-- (autor puede editar su rating/comment). Las nuevas policies agregan capacidad
-- de:
--   - Store members (owner/editor) actualizar owner_response / is_pinned
--   - Mod/admin soft-delete
--
-- IMPORTANTE: Postgres no soporta column-level WITH CHECK robusto, así que la
-- validación de qué columnas se pueden tocar se complementa en el endpoint api.
-- La RLS sólo garantiza "alguien con rol válido puede hacer update"; el endpoint
-- garantiza "sólo las columnas correctas viajan en el update".

drop policy if exists "Store members can respond to reviews" on public.store_reviews;
create policy "Store members can respond to reviews"
  on public.store_reviews
  for update
  to authenticated
  using (
    public.is_store_member(store_id, 'editor')
    or public.authorize('admin')
  )
  with check (
    public.is_store_member(store_id, 'editor')
    or public.authorize('admin')
  );

drop policy if exists "Moderators can soft delete reviews" on public.store_reviews;
create policy "Moderators can soft delete reviews"
  on public.store_reviews
  for update
  to authenticated
  using (public.authorize('moderator'))
  with check (public.authorize('moderator'));

-- =============================================================================
-- 5) Función de estadísticas agregadas por store_slug
-- =============================================================================

create or replace function public.get_store_rating_stats(p_store_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_avg numeric;
  v_total int;
  v_distribution jsonb;
begin
  select id into v_store_id
    from public.stores
    where slug = p_store_slug
    limit 1;

  if v_store_id is null then
    return jsonb_build_object(
      'avg_rating', null,
      'total_reviews', 0,
      'distribution', jsonb_build_object(
        '1', 0, '2', 0, '3', 0, '4', 0, '5', 0
      )
    );
  end if;

  select
    coalesce(round(avg(rating)::numeric, 2), 0),
    count(*)
  into v_avg, v_total
  from public.store_reviews
  where store_id = v_store_id and deleted_at is null;

  select jsonb_object_agg(rating::text, cnt)
  into v_distribution
  from (
    select r.rating, coalesce(sr.cnt, 0) as cnt
    from (values (1), (2), (3), (4), (5)) as r(rating)
    left join (
      select rating, count(*)::int as cnt
      from public.store_reviews
      where store_id = v_store_id and deleted_at is null
      group by rating
    ) sr on sr.rating = r.rating
  ) merged;

  return jsonb_build_object(
    'avg_rating', v_avg,
    'total_reviews', v_total,
    'distribution', v_distribution
  );
end;
$$;

grant execute on function public.get_store_rating_stats(text) to anon, authenticated, service_role;

-- =============================================================================
-- Comentarios
-- =============================================================================
comment on column public.store_reviews.helpful_count is
  'Contador de votos "útil". Mantenido por trigger store_review_helpful_count_trg.';
comment on column public.store_reviews.is_pinned is
  'Reviews destacadas por la tienda o admin.';
comment on column public.store_reviews.owner_response is
  'Respuesta opcional del dueño/editor de la tienda. Máx 1000 chars.';
comment on column public.store_reviews.deleted_at is
  'Soft delete. Si no es null, la review está oculta del listado público.';
comment on function public.get_store_rating_stats(text) is
  'Retorna avg_rating, total_reviews y distribución 1-5 estrellas para un store por slug. Excluye soft-deleted.';
comment on function public.update_store_review_helpful_count() is
  'Mantiene store_reviews.helpful_count consistente con votos en store_review_helpful.';
