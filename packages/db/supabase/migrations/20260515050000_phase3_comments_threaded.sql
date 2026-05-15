-- ============================================================================
-- Phase 3: Threaded comments (Reddit-style) with ltree adjacency-list paths.
--
-- Scope:
--   1. Defensive fallback for Phase 0 role infrastructure (`public.authorize`)
--      so this migration is self-contained while other phases land.
--   2. `comments` table with ltree `path`, soft delete, edit window enforced
--      via RLS, and a max depth of 10.
--   3. `comment_votes` with score sync trigger.
--   4. `comment_moderation_log` (append-only audit) maintained by a trigger.
--   5. Helper RPCs: `get_comment_thread`, `get_product_comments`.
--
-- Notes:
--   * `parent_id` uses ON DELETE RESTRICT so a soft-deleted root cannot be
--     hard-deleted and break its subtree.
--   * `author_id` keeps `ON DELETE SET NULL` so we don't blow away threads
--     when a user is removed; the body is preserved unless soft-deleted.
--   * `f_comment_label` strips dashes from the uuid so it fits ltree labels
--     (only [A-Za-z0-9_] allowed by ltree).
-- ============================================================================

create extension if not exists ltree;

-- ---------------------------------------------------------------------------
-- 0. Phase 0 fallback: minimal user_roles + authorize() helper.
-- These objects use `if not exists` / `create or replace` so they will be
-- compatible with the canonical Phase 0 migration if/when it lands first.
-- ---------------------------------------------------------------------------
do $do$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('user', 'moderator', 'admin');
  end if;
end
$do$;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_self_read" on public.user_roles;
create policy "user_roles_self_read"
  on public.user_roles for select
  using (auth.uid() = user_id);

-- `authorize(role)` returns true if the calling user has *at least* the given role.
-- Hierarchy: admin > moderator > user. Anyone authenticated is implicitly 'user'
-- (no row required) to match the brief's "authorize('user') ≈ logueado".
create or replace function public.authorize(required_role public.app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  -- 'user' = any authenticated user.
  if required_role = 'user' then
    return true;
  end if;

  -- 'moderator' satisfied by moderator OR admin grants.
  if required_role = 'moderator' then
    return exists (
      select 1 from public.user_roles
      where user_id = v_uid and role in ('moderator', 'admin')
    );
  end if;

  -- 'admin' satisfied only by admin.
  if required_role = 'admin' then
    return exists (
      select 1 from public.user_roles
      where user_id = v_uid and role = 'admin'
    );
  end if;

  return false;
end;
$$;

grant execute on function public.authorize(public.app_role) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 1. Enums + tables
-- ---------------------------------------------------------------------------
do $do$
begin
  if not exists (select 1 from pg_type where typname = 'comment_target_type') then
    create type public.comment_target_type as enum ('product');
  end if;
end
$do$;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type public.comment_target_type not null default 'product',
  target_id uuid not null,
  parent_id uuid references public.comments(id) on delete restrict,
  root_id uuid not null,
  path public.ltree not null,
  depth int not null default 0 check (depth >= 0 and depth <= 10),
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  score int not null default 0,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_reason text,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

-- Listing/thread access patterns.
create index comments_target_idx on public.comments (target_type, target_id, created_at desc);
create index comments_path_idx on public.comments using gist (path);
create index comments_author_idx on public.comments (author_id);
create index comments_root_idx on public.comments (root_id);
-- Para listar roots por target rápido (parent_id is null + ordering).
create index comments_target_roots_idx on public.comments (target_type, target_id, score desc, created_at desc)
  where parent_id is null;

create table public.comment_votes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index comment_votes_user_idx on public.comment_votes (user_id);

create table public.comment_moderation_log (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  moderator_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('soft_delete', 'restore', 'edit_reason')),
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index comment_moderation_log_comment_idx on public.comment_moderation_log (comment_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Triggers: compute path/root/depth + maintain score + audit log.
-- ---------------------------------------------------------------------------

-- 2.1 path/root/depth on insert. We compute these instead of trusting clients.
create or replace function public.compute_comment_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_path public.ltree;
  v_parent_depth int;
  v_self_label text;
  v_parent_root uuid;
begin
  v_self_label := replace(new.id::text, '-', '');

  if new.parent_id is null then
    new.path := v_self_label::public.ltree;
    new.root_id := new.id;
    new.depth := 0;
  else
    select path, depth, root_id
      into v_parent_path, v_parent_depth, v_parent_root
      from public.comments
      where id = new.parent_id;

    if v_parent_path is null then
      raise exception 'parent comment % not found', new.parent_id;
    end if;

    new.depth := v_parent_depth + 1;
    if new.depth > 10 then
      raise exception 'comment depth exceeds maximum of 10';
    end if;
    new.path := v_parent_path operator(public.||) v_self_label::public.ltree;
    new.root_id := v_parent_root;
  end if;
  return new;
end;
$$;

drop trigger if exists comments_path_trg on public.comments;
create trigger comments_path_trg
  before insert on public.comments
  for each row execute function public.compute_comment_path();

-- 2.2 score sync from comment_votes.
create or replace function public.sync_comment_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment_id uuid;
begin
  v_comment_id := coalesce(new.comment_id, old.comment_id);
  update public.comments
    set score = coalesce((
      select sum(value)::int from public.comment_votes where comment_id = v_comment_id
    ), 0)
    where id = v_comment_id;
  return null;
end;
$$;

drop trigger if exists comment_votes_score_trg on public.comment_votes;
create trigger comment_votes_score_trg
  after insert or update or delete on public.comment_votes
  for each row execute function public.sync_comment_score();

-- 2.3 moderation audit on soft-delete/restore. Append-only log; we don't expose
-- the insert path to clients — they hit the comments table and the trigger
-- writes the audit row using the authenticated user as moderator_id.
create or replace function public.log_comment_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if (old.deleted_at is null) and (new.deleted_at is not null) then
    v_action := 'soft_delete';
  elsif (old.deleted_at is not null) and (new.deleted_at is null) then
    v_action := 'restore';
  elsif (old.deleted_reason is distinct from new.deleted_reason) then
    v_action := 'edit_reason';
  else
    return new;
  end if;

  insert into public.comment_moderation_log(comment_id, moderator_id, action, reason, before_snapshot, after_snapshot)
  values (
    new.id,
    auth.uid(),
    v_action,
    new.deleted_reason,
    jsonb_build_object(
      'deleted_at', old.deleted_at,
      'deleted_by', old.deleted_by,
      'deleted_reason', old.deleted_reason
    ),
    jsonb_build_object(
      'deleted_at', new.deleted_at,
      'deleted_by', new.deleted_by,
      'deleted_reason', new.deleted_reason
    )
  );
  return new;
end;
$$;

drop trigger if exists comments_moderation_log_trg on public.comments;
create trigger comments_moderation_log_trg
  after update on public.comments
  for each row execute function public.log_comment_moderation();

-- 2.4 edited_at stamp when body changes (and it's not the initial insert).
create or replace function public.stamp_comment_edited()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.body is distinct from new.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists comments_edited_trg on public.comments;
create trigger comments_edited_trg
  before update on public.comments
  for each row execute function public.stamp_comment_edited();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.comments enable row level security;
alter table public.comment_votes enable row level security;
alter table public.comment_moderation_log enable row level security;

-- 3.1 comments
drop policy if exists comments_select_all on public.comments;
create policy comments_select_all
  on public.comments for select
  using (true);

drop policy if exists comments_insert_authenticated on public.comments;
create policy comments_insert_authenticated
  on public.comments for insert
  with check (
    public.authorize('user'::public.app_role)
    and auth.uid() = author_id
    and deleted_at is null
  );

-- Update is allowed when:
--   (a) Author edits within 5 min of creation, comment is not soft-deleted,
--       and the only fields they change are `body` (edited_at trigger stamps the timestamp).
--   (b) Author soft-deletes their own comment (deleted_by = auth.uid()).
--   (c) Moderator or admin moderates (soft-delete / restore / reason edit).
-- We rely on policy USING/WITH CHECK; column-level whitelisting per role is
-- enforced at the API layer (defense-in-depth).
drop policy if exists comments_update_author_edit on public.comments;
create policy comments_update_author_edit
  on public.comments for update
  using (
    auth.uid() = author_id
    and deleted_at is null
    and created_at > now() - interval '5 minutes'
  )
  with check (
    auth.uid() = author_id
  );

drop policy if exists comments_update_author_soft_delete on public.comments;
create policy comments_update_author_soft_delete
  on public.comments for update
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and deleted_at is not null
    and deleted_by = auth.uid()
  );

drop policy if exists comments_update_moderator on public.comments;
create policy comments_update_moderator
  on public.comments for update
  using (public.authorize('moderator'::public.app_role))
  with check (public.authorize('moderator'::public.app_role));

-- No delete policy → hard delete is denied for everyone (preserves tree).

-- 3.2 comment_votes
drop policy if exists comment_votes_select_all on public.comment_votes;
create policy comment_votes_select_all
  on public.comment_votes for select
  using (true);

drop policy if exists comment_votes_upsert_self on public.comment_votes;
create policy comment_votes_upsert_self
  on public.comment_votes for insert
  with check (
    public.authorize('user'::public.app_role) and auth.uid() = user_id
  );

drop policy if exists comment_votes_update_self on public.comment_votes;
create policy comment_votes_update_self
  on public.comment_votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists comment_votes_delete_self on public.comment_votes;
create policy comment_votes_delete_self
  on public.comment_votes for delete
  using (auth.uid() = user_id);

-- 3.3 comment_moderation_log: read-only for moderators+. Inserts only via trigger.
drop policy if exists comment_moderation_log_select_mod on public.comment_moderation_log;
create policy comment_moderation_log_select_mod
  on public.comment_moderation_log for select
  using (public.authorize('moderator'::public.app_role));

-- ---------------------------------------------------------------------------
-- 4. Helper RPCs
-- ---------------------------------------------------------------------------

-- 4.1 Full thread by root_id. Ordered by ltree path → natural BFS-ish layout.
-- Soft-deleted comments are returned but their body is redacted to null.
create or replace function public.get_comment_thread(p_root_id uuid, p_limit int default 100)
returns table (
  id uuid,
  target_type public.comment_target_type,
  target_id uuid,
  parent_id uuid,
  root_id uuid,
  path text,
  depth int,
  author_id uuid,
  body text,
  score int,
  deleted_at timestamptz,
  deleted_reason text,
  edited_at timestamptz,
  created_at timestamptz,
  author_username text,
  author_avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.target_type,
    c.target_id,
    c.parent_id,
    c.root_id,
    c.path::text,
    c.depth,
    c.author_id,
    case when c.deleted_at is null then c.body else null end as body,
    c.score,
    c.deleted_at,
    c.deleted_reason,
    c.edited_at,
    c.created_at,
    p.username,
    p.avatar_url
  from public.comments c
  left join public.profiles p on p.id = c.author_id
  where c.root_id = p_root_id
  order by c.path
  limit coalesce(p_limit, 100);
$$;

grant execute on function public.get_comment_thread(uuid, int) to anon, authenticated;

-- 4.2 Roots for a product, with reply count and sort options.
create or replace function public.get_product_comments(
  p_product_id uuid,
  p_sort text default 'best',
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  target_id uuid,
  author_id uuid,
  body text,
  score int,
  deleted_at timestamptz,
  deleted_reason text,
  edited_at timestamptz,
  created_at timestamptz,
  reply_count bigint,
  author_username text,
  author_avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  with roots as (
    select c.*
    from public.comments c
    where c.target_type = 'product'
      and c.target_id = p_product_id
      and c.parent_id is null
  ),
  counted as (
    select
      r.*,
      (select count(*) from public.comments d where d.root_id = r.id and d.id <> r.id) as reply_count
    from roots r
  )
  select
    c.id,
    c.target_id,
    c.author_id,
    case when c.deleted_at is null then c.body else null end as body,
    c.score,
    c.deleted_at,
    c.deleted_reason,
    c.edited_at,
    c.created_at,
    c.reply_count,
    p.username,
    p.avatar_url
  from counted c
  left join public.profiles p on p.id = c.author_id
  order by
    case when p_sort = 'best' then c.score end desc nulls last,
    case when p_sort = 'best' then c.created_at end desc,
    case when p_sort = 'recent' then c.created_at end desc,
    case when p_sort = 'old' then c.created_at end asc
  limit coalesce(p_limit, 50)
  offset coalesce(p_offset, 0);
$$;

grant execute on function public.get_product_comments(uuid, text, int, int) to anon, authenticated;

-- 4.3 Helper to fetch the calling user's own vote on a set of comments.
create or replace function public.get_my_comment_votes(p_comment_ids uuid[])
returns table (comment_id uuid, value smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select cv.comment_id, cv.value
  from public.comment_votes cv
  where cv.user_id = auth.uid()
    and cv.comment_id = any(p_comment_ids);
$$;

grant execute on function public.get_my_comment_votes(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Grants (default anon select via RLS; explicit for clarity)
-- ---------------------------------------------------------------------------
grant select on public.comments to anon, authenticated;
grant insert, update on public.comments to authenticated;
grant select, insert, update, delete on public.comment_votes to authenticated;
grant select on public.comment_votes to anon;
grant select on public.comment_moderation_log to authenticated;
