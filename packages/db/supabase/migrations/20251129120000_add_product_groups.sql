create table public.product_groups (
    id uuid primary key default gen_random_uuid(),
    name text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.products
add column group_id uuid references public.product_groups(id) on delete set null;
create index idx_products_group_id on public.products(group_id);
alter table public.product_groups enable row level security;
create policy "Public product_groups are viewable by everyone" on public.product_groups for select using (true);
