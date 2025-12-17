-- Remove EAN column from products as it is not used in Chile
alter table public.products drop column if exists ean;
-- Create cached_specs_extractions table to store AI-extracted specs
create table public.cached_specs_extractions (
    id uuid primary key default gen_random_uuid(),
    mpn text not null unique,
    specs jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Enable RLS
alter table public.cached_specs_extractions enable row level security;
-- Policies
-- Allow read access to everyone (consistent with other tables)
create policy "Public cached_specs_extractions are viewable by everyone" on public.cached_specs_extractions for select using (true);
-- Allow insert/update only to service role (implicit, as no other policy allows it);
