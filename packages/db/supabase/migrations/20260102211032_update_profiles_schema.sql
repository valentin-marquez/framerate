-- Add full_name column
alter table public.profiles add column if not exists full_name text;

-- Make username unique
-- Constraint profiles_username_key already exists, so we skip adding it.
-- alter table public.profiles add constraint profiles_username_key unique (username);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
-- Drop existing policies to avoid conflicts if they exist
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );
