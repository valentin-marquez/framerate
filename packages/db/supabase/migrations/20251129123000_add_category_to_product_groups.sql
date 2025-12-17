alter table public.product_groups
add column category_id uuid references public.categories(id) on delete cascade;
create index idx_product_groups_category_id on public.product_groups(category_id);
