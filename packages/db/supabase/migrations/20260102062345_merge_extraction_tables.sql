-- Rename ai_extraction_jobs to extraction_jobs
alter table public.ai_extraction_jobs rename to extraction_jobs;

-- Migrate data from cached_specs_extractions to extraction_jobs
-- We only migrate items that don't already exist in extraction_jobs (by MPN)
-- We use dummy values for required columns that don't exist in cache
insert into public.extraction_jobs (
    mpn,
    category,
    raw_text,
    status,
    result,
    created_at,
    updated_at
)
select
    c.mpn,
    'unknown', -- Dummy category
    '', -- Dummy raw_text
    'completed'::public.job_status,
    jsonb_build_object('specs', c.specs), -- Wrap specs in result object to match structure
    c.created_at,
    c.updated_at
from public.cached_specs_extractions c
where not exists (
    select 1 from public.extraction_jobs j where j.mpn = c.mpn
);

-- Drop the old table
drop table public.cached_specs_extractions;

-- Rename trigger and function for consistency
alter trigger ai_extraction_jobs_updated_at_trigger on public.extraction_jobs rename to extraction_jobs_updated_at_trigger;

alter function public.ai_extraction_jobs_set_updated_at() rename to extraction_jobs_set_updated_at;

-- Update the function fetch_pending_jobs to use the new table name
-- Note: We need to drop the old function first because the return type signature changes (setof ai_extraction_jobs -> setof extraction_jobs)
-- Actually, since we renamed the table, the type 'ai_extraction_jobs' might have been renamed to 'extraction_jobs' automatically by Postgres?
-- Postgres usually renames the composite type associated with the table.
-- Let's assume it does, but explicitly recreating the function is safer.

drop function if exists public.fetch_pending_jobs(int);

create or replace function public.fetch_pending_jobs(limit_count int)
returns setof public.extraction_jobs as $$
begin
  return query
  update public.extraction_jobs
  set
    status = 'processing'::public.job_status,
    updated_at = timezone('utc'::text, now()),
    attempts = attempts + 1
  where id in (
    select id
    from public.extraction_jobs
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
