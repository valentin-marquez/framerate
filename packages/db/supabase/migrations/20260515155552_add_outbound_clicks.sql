-- ============================================
-- outbound_clicks
-- ============================================
-- Registro de clicks salientes hacia tiendas. Útil para entender qué páginas
-- generan tráfico, qué tiendas/productos son más clickeados y proveer atribución
-- (utm_*) recíproca con lo que el partner ve de su lado.
--
-- Diseño:
-- * INSERT abierto (anon + authenticated) — el endpoint del API valida payload.
-- * SELECT sin policy ⇒ sólo service_role puede leer.
-- * user_id es opcional (NULL = anónimo o usuario sin sesión al click).
-- * referencias a listings/stores/products usan ON DELETE SET NULL para no
--   perder historial de analytics cuando se borra un listing.

create table public.outbound_clicks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    listing_id uuid references public.listings(id) on delete set null,
    store_id uuid references public.stores(id) on delete set null,
    product_id uuid references public.products(id) on delete set null,
    -- Contexto de UI: "product_details_hero" | "product_details_comparison" |
    -- "product_details_mobile" | "quote_item" | "quote_pdf" | "store_page" | ...
    source text not null,
    -- URL con utm_* ya aplicado (lo que efectivamente se abrió en el navegador).
    target_url text not null,
    -- Path interno desde donde se hizo click (ej. "/producto/rtx-4090-msi").
    referrer_path text,
    user_agent text,
    created_at timestamptz not null default now()
);

-- ============================================
-- Indexes (analytics queries)
-- ============================================

create index idx_outbound_clicks_store_created on public.outbound_clicks(store_id, created_at desc);
create index idx_outbound_clicks_product_created on public.outbound_clicks(product_id, created_at desc);
create index idx_outbound_clicks_listing_created on public.outbound_clicks(listing_id, created_at desc);
create index idx_outbound_clicks_user_created on public.outbound_clicks(user_id, created_at desc) where user_id is not null;
create index idx_outbound_clicks_source_created on public.outbound_clicks(source, created_at desc);
create index idx_outbound_clicks_created on public.outbound_clicks(created_at desc);

-- ============================================
-- RLS
-- ============================================

alter table public.outbound_clicks enable row level security;

-- INSERT: abierto. Se asume que el client puede falsificar payload — está OK porque
-- esto es analítica, no fuente de verdad. El API valida y limita.
create policy "Anyone can record outbound clicks"
    on public.outbound_clicks for insert
    with check (true);

-- (Sin policies SELECT/UPDATE/DELETE ⇒ sólo service_role accede a esos verbs.)

comment on table public.outbound_clicks is
    'Registro de clicks salientes a tiendas externas. Source-of-truth para analytics de referral.';
