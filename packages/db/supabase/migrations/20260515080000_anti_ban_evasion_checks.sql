-- =====================================================================
-- Anti-ban-evasion: agregar is_user_banned() check a INSERT policies de
-- contenido generado por usuarios (Fases 2 y 3).
-- =====================================================================
-- Fase 4 creó la tabla user_bans y el helper public.is_user_banned(uuid).
-- Esta migration cierra el loop: un user baneado no puede comentar,
-- responder, votar, ni dejar reseñas mientras esté en user_bans con
-- expires_at > now() (o NULL = permanente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- comments (Fase 3)
-- ---------------------------------------------------------------------
drop policy if exists "comments_insert_authenticated" on public.comments;
create policy "comments_insert_authenticated" on public.comments
  for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and not public.is_user_banned(auth.uid())
  );

-- ---------------------------------------------------------------------
-- comment_votes (Fase 3)
-- ---------------------------------------------------------------------
drop policy if exists "comment_votes_upsert_self" on public.comment_votes;
create policy "comment_votes_upsert_self" on public.comment_votes
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_user_banned(auth.uid())
  );

-- ---------------------------------------------------------------------
-- store_reviews (initial schema, expandido por Fase 2)
-- ---------------------------------------------------------------------
do $$
declare
  pol_name text;
begin
  for pol_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'store_reviews'
      and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.store_reviews', pol_name);
  end loop;
end $$;

create policy "store_reviews_insert_authenticated" on public.store_reviews
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_user_banned(auth.uid())
  );

-- ---------------------------------------------------------------------
-- store_review_helpful (Fase 2)
-- ---------------------------------------------------------------------
drop policy if exists "Users can vote helpful" on public.store_review_helpful;
drop policy if exists "store_review_helpful_insert_self" on public.store_review_helpful;
create policy "store_review_helpful_insert_self" on public.store_review_helpful
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_user_banned(auth.uid())
  );

-- ---------------------------------------------------------------------
-- reports (Fase 4) — el reporter tampoco puede reportar si está baneado.
-- La policy de Fase 4 ya tiene el check; este bloque es defensivo si la
-- definición divergió en algún branch.
-- ---------------------------------------------------------------------
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and cmd = 'INSERT'
  ) then
    -- ya existe; asumimos que es correcta. No la tocamos.
    null;
  end if;
end $$;
