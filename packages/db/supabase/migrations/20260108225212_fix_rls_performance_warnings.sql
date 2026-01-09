-- Fix RLS performance warnings and duplicate policies
-- Based on Supabase Performance Advisor recommendations

-- ============================================================
-- public.extraction_jobs (formerly ai_extraction_jobs)
-- ============================================================

-- Drop existing policies (using original names from creation)
drop policy if exists "Service role can insert jobs" on public.extraction_jobs;
drop policy if exists "Service role can select jobs" on public.extraction_jobs;
drop policy if exists "Service role can update jobs" on public.extraction_jobs;
drop policy if exists "Service role can delete jobs" on public.extraction_jobs;

-- Recreate policies with optimized auth calls
-- Wrap auth functions in (select ...) to prevent re-evaluation for each row

create policy "Service role can insert jobs" on public.extraction_jobs
  for insert with check ((select auth.role()) = 'service_role');

create policy "Service role can select jobs" on public.extraction_jobs
  for select using ((select auth.role()) = 'service_role');

create policy "Service role can update jobs" on public.extraction_jobs
  for update using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create policy "Service role can delete jobs" on public.extraction_jobs
  for delete using ((select auth.role()) = 'service_role');


-- ============================================================
-- public.profiles
-- ============================================================

-- Drop all duplicate/variant policies to clean up
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;

drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;

drop policy if exists "Users can update own profile" on public.profiles; -- Variant 1
drop policy if exists "Users can update own profile." on public.profiles; -- Variant 2
drop policy if exists "Users can update their own profile" on public.profiles; -- Variant 3
drop policy if exists "Users can update their own profile." on public.profiles; -- Variant 4

-- Recreate single, optimized policies

create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( (select auth.uid()) = id );

create policy "Users can update their own profile"
  on public.profiles for update
  using ( (select auth.uid()) = id );
