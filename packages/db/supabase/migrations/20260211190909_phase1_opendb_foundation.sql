-- Enable pgmq extension
create extension if not exists pgmq;

-- Create enum for raw_feed status
create type public.feed_processing_status as enum ('NEW', 'PROCESSING', 'MATCHED', 'FAILED');

-- Create raw_feed table (The Untrusted Zone)
create table if not exists public.raw_feed (
    id uuid primary key default gen_random_uuid(),
    payload jsonb not null,
    source text not null, -- retailer name or identifier
    external_id text, -- unique identifier from retailer
    ingested_at timestamp with time zone default timezone('utc'::text, now()) not null,
    processing_status public.feed_processing_status default 'NEW' not null,
    match_candidate_id uuid, -- potential link to canonical product
    match_score float, -- confidence score
    error_message text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for processing queue
create index idx_raw_feed_status on public.raw_feed(processing_status);
create index idx_raw_feed_ingested_at on public.raw_feed(ingested_at);

-- Create products_canonical table (The Trusted Zone / OpenDB Projection)
create table if not exists public.products_canonical (
    id uuid primary key, -- matches OpenDB JSON filename/UUID
    specifications jsonb not null default '{}'::jsonb,
    sync_metadata jsonb default '{}'::jsonb, -- generalized metadata
    git_commit_hash char(40),
    git_blob_hash char(40),
    last_synced_at timestamp with time zone,
    is_deleted boolean default false not null,
    archived_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for sync lookup
create index idx_products_canonical_git_hash on public.products_canonical(git_commit_hash);

-- Enforce read-only trigger for products_canonical (except for specific service role)
-- Note: 'janitor_service_account' is a placeholder. In Supabase, usually verify auth.role() or specific user.
-- For now, we'll create the function but comment out the strict enforcement to avoid locking out the developer during setup.
create or replace function public.enforce_read_only_canonical()
returns trigger as $$
begin
  -- Logic to check if user is the janitor service.
  -- For now, allow all writes but log warning or TODO: restrict to service_role
  if current_user not in ('postgres', 'service_role') then
      -- raise exception 'Manual updates prohibited. Commit changes to OpenDB Git Repo.';
      null; 
  end if;
  return new;
end;
$$ language plpgsql;

create trigger enforce_canonical_read_only
before insert or update or delete on public.products_canonical
for each row execute function public.enforce_read_only_canonical();


-- Create foreign key from raw_feed to products_canonical
alter table public.raw_feed 
    add constraint fk_raw_feed_candidate 
    foreign key (match_candidate_id) 
    references public.products_canonical(id) 
    on delete set null;

-- RLS Policies
alter table public.raw_feed enable row level security;
alter table public.products_canonical enable row level security;

-- Public Read Access for Canonical Products
create policy "Public products_canonical are viewable by everyone" 
on public.products_canonical for select using (true);

-- Service Role Access (Full Access)
-- Usually service_role has bypass RLS, but explicit policies help.
create policy "Service role has full access to products_canonical"
on public.products_canonical for all using (
  (select auth.role()) = 'service_role'
);

create policy "Service role has full access to raw_feed"
on public.raw_feed for all using (
  (select auth.role()) = 'service_role'
);
