-- Enable necessary extensions
create extension if not exists "uuid-ossp";
-- Categories (e.g., GPU, CPU, RAM)
create table public.categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    slug text not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Brands (e.g., MSI, ASUS)
create table public.brands (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    slug text not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Products
create table public.products (
    id uuid primary key default gen_random_uuid(),
    category_id uuid references public.categories(id) on delete restrict not null,
    brand_id uuid references public.brands(id) on delete restrict not null,
    name text not null,
    slug text not null unique,
    mpn text, -- Manufacturer Part Number
    ean text, -- European Article Number
    image_url text,
    specs jsonb default '{}'::jsonb not null, -- Flexible specs (GPU fields go here)
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Stores
create table public.stores (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    slug text not null unique,
    url text not null,
    logo_url text,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Listings (Product at a Store)
create table public.listings (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id) on delete cascade not null,
    store_id uuid references public.stores(id) on delete cascade not null,
    url text not null,
    external_id text, -- Store's internal ID for the product
    price_cash integer, -- Current cash price
    price_normal integer, -- Current normal price
    currency text default 'CLP' not null,
    is_active boolean default true not null,
    last_scraped_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(store_id, external_id)
);
-- Price History
create table public.price_history (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid references public.listings(id) on delete cascade not null,
    price_cash integer not null,
    price_normal integer not null,
    currency text default 'CLP' not null,
    recorded_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Profiles (Extends Supabase Auth)
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text unique,
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Store Reviews
create table public.store_reviews (
    id uuid primary key default gen_random_uuid(),
    store_id uuid references public.stores(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    rating integer check (rating >= 1 and rating <= 5) not null,
    comment text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Product Reviews
create table public.product_reviews (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    rating integer check (rating >= 1 and rating <= 5) not null,
    comment text,
    is_verified_purchase boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Quotes (Cotizaciones)
create table public.quotes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    description text,
    is_public boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Quote Items
create table public.quote_items (
    id uuid primary key default gen_random_uuid(),
    quote_id uuid references public.quotes(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    quantity integer default 1 not null check (quantity > 0),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Price Alerts
create table public.price_alerts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    target_price integer not null,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    triggered_at timestamp with time zone
);
-- RLS Policies (Basic setup)
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.stores enable row level security;
alter table public.listings enable row level security;
alter table public.price_history enable row level security;
alter table public.profiles enable row level security;
alter table public.store_reviews enable row level security;
alter table public.product_reviews enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.price_alerts enable row level security;
-- Public Read Access
create policy "Public categories are viewable by everyone" on public.categories for select using (true);
create policy "Public brands are viewable by everyone" on public.brands for select using (true);
create policy "Public products are viewable by everyone" on public.products for select using (true);
create policy "Public stores are viewable by everyone" on public.stores for select using (true);
create policy "Public listings are viewable by everyone" on public.listings for select using (true);
create policy "Public price_history are viewable by everyone" on public.price_history for select using (true);
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Public store_reviews are viewable by everyone" on public.store_reviews for select using (true);
create policy "Public product_reviews are viewable by everyone" on public.product_reviews for select using (true);
create policy "Public quotes are viewable by everyone" on public.quotes for select using (is_public = true or auth.uid() = user_id);
create policy "Public quote_items are viewable by everyone" on public.quote_items for select using (
    exists (select 1 from public.quotes where id = quote_items.quote_id and (is_public = true or user_id = auth.uid()))
);
-- Authenticated User Access (Create/Update own data)
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can create store reviews" on public.store_reviews for insert with check (auth.uid() = user_id);
create policy "Users can update their own store reviews" on public.store_reviews for update using (auth.uid() = user_id);
create policy "Users can create product reviews" on public.product_reviews for insert with check (auth.uid() = user_id);
create policy "Users can update their own product reviews" on public.product_reviews for update using (auth.uid() = user_id);
create policy "Users can manage their quotes" on public.quotes for all using (auth.uid() = user_id);
create policy "Users can manage their quote items" on public.quote_items for all using (
    exists (select 1 from public.quotes where id = quote_items.quote_id and user_id = auth.uid())
);
create policy "Users can manage their price alerts" on public.price_alerts for all using (auth.uid() = user_id);
