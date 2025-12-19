
-- Agregar tabla de trabajos de extracción de IA y funciones auxiliares
-- Esta tabla se utilizará como una cola simple respaldada por la base de datos para trabajos asíncronos de extracción de IA.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE public.job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END$$;

create table public.ai_extraction_jobs (
    id uuid primary key default gen_random_uuid(),
    mpn text not null,
    category text not null,
    raw_text text not null,
    context jsonb,
    status public.job_status default 'pending'::public.job_status not null,
    result jsonb,
    error_message text,
    attempts integer default 0 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_ai_extraction_jobs_pending on public.ai_extraction_jobs(status, created_at) where status = 'pending';

create or replace function public.ai_extraction_jobs_set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger ai_extraction_jobs_updated_at_trigger
  before update on public.ai_extraction_jobs
  for each row execute procedure public.ai_extraction_jobs_set_updated_at();

alter table public.ai_extraction_jobs enable row level security;

create policy "Service role can insert jobs" on public.ai_extraction_jobs for insert
  with check (auth.role() = 'service_role');

create policy "Service role can select jobs" on public.ai_extraction_jobs for select
  using (auth.role() = 'service_role');

create policy "Service role can update jobs" on public.ai_extraction_jobs for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can delete jobs" on public.ai_extraction_jobs for delete
  using (auth.role() = 'service_role');

create or replace function public.fetch_pending_jobs(limit_count int)
returns setof public.ai_extraction_jobs as $$
begin
  return query
  update public.ai_extraction_jobs
  set
    status = 'processing'::public.job_status,
    updated_at = timezone('utc'::text, now()),
    attempts = attempts + 1
  where id in (
    select id
    from public.ai_extraction_jobs
    where status = 'pending'::public.job_status
      and attempts < 3
    order by created_at asc
    limit limit_count
    for update skip locked
  )
  returning *;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.fetch_pending_jobs(int) to anon, authenticated, service_role;

comment on table public.ai_extraction_jobs is 'Queue table for asynchronous AI extraction jobs (used by Collector/Cortex).';
comment on function public.fetch_pending_jobs is 'Atomically claim up to <limit_count> pending jobs for processing. Uses FOR UPDATE SKIP LOCKED to avoid race conditions.';
